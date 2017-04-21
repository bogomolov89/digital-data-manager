import { Integration } from './../Integration';
import AsyncQueue from './utls/AsyncQueue';

const DEVELOPMENT_URL_PREFIX = 'integration';
const PRODUCTION_URL_PREFIX = 'recs';

const PLACEMENT_TYPE_HOME_PAGE = 'home_page';
const PLACEMENT_TYPE_ITEM_PAGE = 'item_page';
const PLACEMENT_TYPE_PURCHASE_COMPLETE_PAGE = 'purchase_complete_page';

class RichRelevance extends Integration {

  constructor() {
    const optionsWithDefaults = Object.assign({
      apiKey: '',
      useProductionUrl: false,
      sessionIdVar: '',
      homePagePlacements: {}
    }, options);

    super(digitalData, optionsWithDefaults);

    this.addTag({
      type: 'script',
      attr: {
        src: '//media.richrelevance.com/rrserver/js/1.2/p13n.js',
      },
    });
  }

  initialize() {
    this.baseUrlSubdomain = (this.getOption('useProductionUrl')) ? PRODUCTION_URL_PREFIX : DEVELOPMENT_URL_PREFIX;
    this.asyncQueue = new AsyncQueue(this.isLoaded);
    this.load(this.onLoad);
  }

  enrichDigitalData() {
    this.asyncQueue.push(() => {
      window.RR.jsonCallback = () => {
        // Place your rendering logic here. Actual code varies depending on your website implementation.
        console.dir(RR.data.JSON.placements);
        this.onEnrich();
      };
    });
  }

  isLoaded() {
    retunr !!window.RR;
  }

  getPlacements(placementType) {
    switch (placementType) {
    case PLACEMENT_TYPE_HOME_PAGE:
      return
      break;
    }
  }

  addPlacements(placementType) {
    const placements = this.getPlacements(placementType);
    if (placements.length) {
      for (const placementName of placements) {
        window.R3_COMMON.addPlacementType([placementType, placementName].join('.'));
      }
    } else {
      window.R3_COMMON.addPlacementType(placementType);
    }
  }

  rrFlush() {
    window.rr_flush_onload();
    window.r3();
    this.rrFlushed = true;
  }

  trackEvent(event) {
    const methods = {
      [VIEWED_PAGE]: 'onViewedPage',
      [VIEWED_PRODUCT_DETAIL]: 'onViewedProductDetail',
      [ADDED_PRODUCT]: 'onAddedProduct',
      [REMOVED_PRODUCT]: 'onRemovedProduct',
      [COMPLETED_TRANSACTION]: 'onCompletedTransaction',
    };

    const method = methods[event.name];
    if (method) {
      this[method](event);
    }
  }

  onViewedPage(event) {
    const page = event.page || {};
    const user = event.user || {};
    const sessionId = getProp(event, this.getOption('sessionIdVar'));

    this.asyncQueue.push(() => {
      window.R3_COMMON = new r3_common();
      window.R3_COMMON.setApiKey(this.getOption('apiKey'));
      window.R3_COMMON.setBaseUrl(`${window.location.protocol}//${this.baseUrlSubdomain}.richrelevance.com/rrserver/`);
      window.R3_COMMON.setClickthruServer(`${window.location.protocol}//${window.location.host}`);
      window.R3_COMMON.setSessionId(sessionId);
      if (user.userId) {
        window.R3_COMMON.setUserId(user.userId);
      }
    })

    if (page.type === 'home') {
      this.onViewedHome(event);
    }

    setTimeout(() => {
      if (!this.rrFlushed) {
        this.rrFlush();
      }
    }, 100);
  }

  onViewedHome(event) {
    this.asyncQueue.push(() => {
      this.addPlacements(PLACEMENT_TYPE_HOME_PAGE);

      window.R3_HOME = new window.r3_home();
      this.rrFlush();
    });
  }

  onViewedProductDetail(event) {
    const product = event.product;

    this.asyncQueue.push(() => {
      this.addPlacements(PLACEMENT_TYPE_ITEM_PAGE);

      if (product.categoryId) {
        window.R3_COMMON.addCategoryHintId(product.categoryId);
      }

      window.R3_ITEM = new window.r3_item();
      window.R3_ITEM.setId(product.id);
      window.R3_ITEM.setName(product.name);
      this.rrFlush();
    });
  }

  onCompletedTransaction(event) {
    const transaction = event.transaction;
    if (!transaction || !transaction.orderId) return;
    const lineItems = transaction.lineItems || [];

    this.asyncQueue.push(() => {
      this.addPlacements(PLACEMENT_TYPE_PURCHASE_COMPLETE_PAGE);

      window.R3_PURCHASED = new window.r3_purchased();
      window.R3_PURCHASED.setOrderNumber(transaction.orderId);

      for (const lineItem of lineItems) {
        const product = lineItem.product || {};
        const quantity = lineItem.quantity || 1;
        window.R3_PURCHASED.addItemIdPriceQuantity(product.id, product.unitSalePrice, quantity, product.skuCode);
      }
      this.rrFlush();
    });
  }
}

export default RichRelevance;
