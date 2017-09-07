import sha256 from 'crypto-js/sha256';
import utmParams from 'driveback-utils/utmParams';
import htmlGlobals from 'driveback-utils/htmlGlobals';
import cleanObject from 'driveback-utils/cleanObject';
import deleteProperty from 'driveback-utils/deleteProperty';
import { getProp } from 'driveback-utils/dotProp';
import arrayMerge from 'driveback-utils/arrayMerge';
import size from 'driveback-utils/size';
import each from 'driveback-utils/each';
import isCrawler from 'driveback-utils/isCrawler';
import uuid from 'uuid/v4';
import Integration from './../Integration';
import StreamingFilters, {
  pageProps,
  listingProps,
  cartProps,
  productProps,
  transactionProps,
  campaignProps,
  userProps,
  websiteProps,
} from './Streaming/Filters';
import {
  getEnrichableVariableMappingProps,
} from './../IntegrationUtils';
import {
  VIEWED_PAGE,
  VIEWED_CART,
  COMPLETED_TRANSACTION,
  VIEWED_PRODUCT,
  CLICKED_PRODUCT,
  VIEWED_PRODUCT_DETAIL,
  ADDED_PRODUCT,
  REMOVED_PRODUCT,
  VIEWED_PRODUCT_LISTING,
  SEARCHED_PRODUCTS,
  VIEWED_CAMPAIGN,
  CLICKED_CAMPAIGN,
  EXCEPTION,
} from './../events/semanticEvents';

const CUSTOM_TYPE_NUMERIC = 'number';
const CUSTOM_TYPE_STRING = 'string';

export function extractCustoms(source, variableMapping, type) {
  const values = [];
  each(variableMapping, (key, variable) => {
    let value = getProp(source, variable.value);
    if (value !== undefined) {
      if (type === CUSTOM_TYPE_NUMERIC && typeof value !== 'number') {
        value = Number(value);
      } else if (type === CUSTOM_TYPE_STRING && typeof value !== 'string') {
        value = value.toString();
      }
      values.push({
        name: variable.value,
        value,
      });
    }
  });
  return values;
}

class Streaming extends Integration {
  constructor(digitalData, options) {
    const optionsWithDefaults = Object.assign({
      projectId: '',
      projectName: '',
      customDimensions: {},
      customMetrics: {},
    }, options);
    super(digitalData, optionsWithDefaults);
    this.user = {};
    this.website = {};
    this.filters = new StreamingFilters(); // TODO: add custom props    
  }

  initialize() {
    this._isLoaded = true;
    if (isCrawler(htmlGlobals.getNavigator().userAgent)) {
      return false;
    }
    return true;
  }

  getIgnoredEvents() {
    return [VIEWED_PRODUCT, CLICKED_PRODUCT, EXCEPTION];
  }

  getCustomProps() {
    const customProps = [];
    arrayMerge(
      customProps,
      getEnrichableVariableMappingProps(this.getOption('customDimensions')),
    );
    arrayMerge(
      customProps,
      getEnrichableVariableMappingProps(this.getOption('customMetrics')),
    );
    return customProps;
  }

  getEnrichableEventProps(event) {
    const mapping = {
      [VIEWED_PAGE]: ['page', 'user', 'website'],
      [VIEWED_CART]: ['cart'],
      [COMPLETED_TRANSACTION]: ['transaction'],
      [VIEWED_PRODUCT_DETAIL]: ['product'],
      [VIEWED_PRODUCT_LISTING]: ['listing'],
      [SEARCHED_PRODUCTS]: ['listing'],
    };

    const enrichableProps = mapping[event.name] || [];
    arrayMerge(
      enrichableProps,
      this.getCustomProps(),
    );

    return enrichableProps;
  }

  getValidationFields(...keys) {
    const fieldsMapping = {
      user: userProps,
      website: websiteProps,
      page: pageProps,
      cart: cartProps,
      listing: listingProps,
      transaction: transactionProps,
      product: productProps,
      campaign: campaignProps,
    };

    const validationFields = (Array.isArray(keys)) ? keys.reduce((result, key) => {
      fieldsMapping[key].forEach((prop) => {
        result.push([key, prop].join('.'));
        if (key === 'campaign') {
          result.push(['campaigns[]', prop].join('.'));
        }
      });
      return result;
    }, []) : [];

    arrayMerge(validationFields, this.getCustomProps());
    arrayMerge(validationFields, ['category', 'label']);

    return validationFields;
  }

  getEventValidationConfig(event) {
    const productFields = () => this.getValidationFields('product');
    const mapping = {
      [VIEWED_PAGE]: {
        fields: this.getValidationFields('user', 'page', 'website'),
      },
      [VIEWED_CART]: {
        fields: this.getValidationFields('cart'),
      },
      [COMPLETED_TRANSACTION]: {
        fields: this.getValidationFields('transaction'),
      },
      [VIEWED_PRODUCT_DETAIL]: {
        fields: productFields,
      },
      [ADDED_PRODUCT]: {
        fields: productFields,
      },
      [REMOVED_PRODUCT]: {
        fields: productFields,
      },
      [VIEWED_PRODUCT_LISTING]: {
        fields: this.getValidationFields('listing'),
      },
      [SEARCHED_PRODUCTS]: {
        fields: this.getValidationFields('listing'),
      },
      [VIEWED_CAMPAIGN]: {
        fields: this.getValidationFields('campaign'),
      },
      [CLICKED_CAMPAIGN]: {
        fields: this.getValidationFields('campaign'),
      },
    };

    const validationConfig = mapping[event.name] || {};
    if (typeof validationConfig.fields === 'function') {
      validationConfig.fields = validationConfig.fields();
    } else {
      validationConfig.fields = validationConfig.fields || this.getValidationFields();
    }

    return validationConfig;
  }

  allowCustomEvents() {
    return true;
  }

  normalize(hitData) {
    const campaign = utmParams(htmlGlobals.getLocation().search);
    const hitId = uuid();
    const commonFields = cleanObject({
      hitId,
      projectId: this.getOption('projectId'),
      projectName: this.getOption('projectName'),
      anonymousId: this.anonymousId,
      userId: this.userId,
      context: {
        campaign: size(campaign) ? campaign : undefined,
        library: this.library,
        page: {
          path: htmlGlobals.getLocation().pathname,
          referrer: htmlGlobals.getDocument().referrer,
          search: htmlGlobals.getLocation().search,
          title: htmlGlobals.getDocument().title,
          url: htmlGlobals.getLocation().href,
          hash: htmlGlobals.getLocation().hash,
        },
        userAgent: htmlGlobals.getNavigator().userAgent,
      },
      sentAt: (new Date()).toISOString(),
      version: 1,
    });

    return Object.assign(hitData, commonFields);
  }

  getAnonymousId() {
    return this.anonymousId;
  }

  getUserId() {
    return this.userId;
  }

  trackEvent(event) {
    // identify
    if (event.user) {
      const user = event.user || {};
      if (user.email) {
        user.emailHash = sha256(user.email).toString();
      }
      this.anonymousId = user.anonymousId;
      this.userId = user.userId ? String(user.userId) : undefined;
      this.user = { ...this.user, ...this.filters.filterUser(user) };
    }

    if (event.website) {
      const website = event.website;
      this.website = this.filters.filterWebsite(website);
    }

    const customDimensions = extractCustoms(event, this.getOption('customDimensions'), CUSTOM_TYPE_STRING);
    const customMetrics = extractCustoms(event, this.getOption('customMetrics'), CUSTOM_TYPE_NUMERIC);

    if (customDimensions.length) event.customDimensions = customDimensions;
    if (customMetrics.length) event.customMetrics = customMetrics;

    deleteProperty(event, 'user');
    deleteProperty(event, 'website');

    this.sendEventHit(event);
  }

  sendEventHit(event) {
    const hitData = this.normalize({
      event: this.filters.filterEventHit(event),
      user: this.user,
      website: this.website,
      type: 'event',
    });
    this.send(hitData);
  }

  getCacheKey() {
    return ['ddm', 'stream', this.projectId].join(':');
  }

  send(hitData) {
    /* 
    try {
      const streamCache = window.localStorage.getItem(this.getCacheKey());
      window.localStorage.setItem(this.getCacheKey(hitId), JSON.stringify(hitData));
    } catch (e) {
      // localstorage not supported
      // TODO: save to memory
    } */
    window.fetch('//track.ddmanager.ru/collect', {
      method: 'post',
      credentials: 'include',
      mode: 'no-cors',
      body: JSON.stringify(hitData),
    }).then((response) => {
      if (response.ok) {
        // window.localStorage.removeItem(this.getCacheKey(hitData.hitId));
      }
    });
  }
}

export default Streaming;
