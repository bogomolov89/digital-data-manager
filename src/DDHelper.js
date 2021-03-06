import { getProp, setProp } from 'driveback-utils/dotProp';
import clone from 'driveback-utils/clone';

function matchProductById(id, product) {
  return product.id && String(product.id) === String(id);
}

function matchProductBySkuCode(skuCode, product) {
  return product.skuCode && String(product.skuCode) === String(skuCode);
}

function matchProduct(id, skuCode, product) {
  return (!skuCode || matchProductBySkuCode(skuCode, product)) && matchProductById(id, product);
}

class DDHelper {
  static get(key, digitalData) {
    const value = getProp(digitalData, key);
    return clone(value);
  }

  static set(key, value, digitalData) {
    setProp(digitalData, key, clone(value));
  }

  static getProduct(id, skuCode, digitalData) {
    if (digitalData.product && String(digitalData.product.id) === String(id)) {
      return clone(digitalData.product);
    }
    // search in listings
    let result;

    ['listing', 'recommendation', 'wishlist'].some((listingKey) => {
      let listings = digitalData[listingKey];
      if (listings) {
        if (!Array.isArray(listings)) {
          listings = [listings];
        }
        listings.some((listing) => {
          if (listing.items && listing.items.length) {
            listing.items.some((listingItem) => {
              if (matchProduct(id, skuCode, listingItem)) {
                result = clone(listingItem);
                return true;
              }
              return false;
            });
            if (result) return true;
          }
          return false;
        });
      }
      if (result) return true;
      return false;
    });

    if (result) return result;

    // search in cart
    if (digitalData.cart && digitalData.cart.lineItems && digitalData.cart.lineItems.length) {
      digitalData.cart.lineItems.some((lineItem) => {
        if (matchProduct(id, skuCode, lineItem.product)) {
          result = clone(lineItem.product);
          return true;
        }
        return false;
      });
    }

    return result;
  }

  static getListItem(id, digitalData, listId) {
    let result;

    ['listing', 'recommendation', 'wishlist'].some((listingKey) => {
      let listings = digitalData[listingKey];
      if (listings) {
        if (!Array.isArray(listings)) {
          listings = [listings];
        }
        listings.some((listing) => {
          if (listing.items && listing.items.length && (!listId || listId === listing.listId)) {
            for (let i = 0, length = listing.items.length; i < length; i += 1) {
              if (matchProductById(id, listing.items[i])) {
                const product = clone(listing.items[i]);
                result = {};
                result.product = product;
                result.position = (i + 1);
                result.listId = listId || listing.listId;
                result.listName = listing.listName;
                return true;
              }
            }
          }
          return false;
        });
        if (result) return true;
      }
      return false;
    });

    return result;
  }

  static getCampaign(id, digitalData) {
    let result;
    if (digitalData.campaigns && digitalData.campaigns.length) {
      digitalData.campaigns.some((campaign) => {
        if (campaign.id && String(campaign.id) === String(id)) {
          result = clone(campaign);
          return true;
        }
        return false;
      });
    }
    return result;
  }
}

export default DDHelper;
