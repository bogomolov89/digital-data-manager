import type from 'component-type';
import DDHelper from './DDHelper.js';

class EventDataEnricher
{
  static product(product, digitalData) {
    product = product || {};
    let productId;
    if (type(product) === 'object') {
      productId = product.id;
    } else {
      productId = product;
      product = {
        id: productId
      };
    }

    if (productId) {
      const ddlProduct = DDHelper.getProduct(productId, digitalData) || {};
      if (ddlProduct) {
        product = Object.assign(ddlProduct, product);
      }
    }

    return product;
  }

  static transaction(transaction, digitalData) {
    transaction = transaction || {};
    const ddlTransaction = DDHelper.get('transaction', digitalData) || {};
    if (ddlTransaction) {
      transaction = Object.assign(ddlTransaction, transaction);
    }

    return transaction;
  }

  static campaign(campaign, digitalData) {
    campaign = campaign || {};
    let campaignId;
    if (type(campaign) === 'object') {
      campaignId = campaign.id;
    } else {
      campaignId = campaign;
      campaign = {
        id: campaignId
      };
    }

    if (campaignId) {
      const ddlCampaign = DDHelper.getCampaign(campaignId, digitalData) || {};
      if (ddlCampaign) {
        campaign = Object.assign(ddlCampaign, campaign);
      }
    }

    return campaign;
  }

  static campaigns(campaigns, digitalData) {
    campaigns = campaigns || [];
    const enrichedCampaigns = [];
    if (campaigns && Array.isArray(campaigns)) {
      for (let campaign of campaigns) {
        campaign = EventDataEnricher.campaign(campaign, digitalData);
        enrichedCampaigns.push(campaign);
      }
    }

    return enrichedCampaigns;
  }

  static items(items, digitalData) {
    items = items || [];
    const enrichedItems = [];
    if (items && Array.isArray(items)) {
      for (let product of items) {
        product = EventDataEnricher.product(product, digitalData);
        enrichedItems.push(product);
      }
    }

    return enrichedItems;
  }

  static lineItems(lineItems, digitalData) {
    lineItems = lineItems || [];
    if (lineItems && Array.isArray(lineItems)) {
      for (let lineItem of lineItems) {
        lineItem.product = EventDataEnricher.product(lineItem.product, digitalData);
      }
    }

    return lineItems;
  }

  static user(user, digitalData) {
    user = user || {};
    const ddlUser = DDHelper.get('user', digitalData) || {};
    if (ddlUser) {
      user = Object.assign(ddlUser, user);
    }

    return user;
  }

  static page(page, digitalData) {
    page = page || {};
    const ddlPage = DDHelper.get('page', digitalData) || {};
    if (ddlPage) {
      page = Object.assign(ddlPage, page);
    }

    return page;
  }
}

export default EventDataEnricher;
