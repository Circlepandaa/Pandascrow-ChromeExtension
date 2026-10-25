// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { extractListing, findPrice, siteFor } from '../src/content/extract';
import { parseBody, tokenExpiry } from '../src/lib/api';
import { money, parseAmount, timeAgo } from '../src/lib/format';

function doc(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html');
}

describe('siteFor', () => {
  it('recognises listing pages only', () => {
    expect(siteFor(new URL('https://www.facebook.com/marketplace/item/123456/'))).toBe('facebook');
    expect(siteFor(new URL('https://web.facebook.com/marketplace/item/9/?ref=x'))).toBe('facebook');
    expect(siteFor(new URL('https://www.facebook.com/marketplace/lagos/'))).toBeNull();
    expect(siteFor(new URL('https://jiji.ng/lekki/mobile-phones/iphone-13-abc.html'))).toBe('jiji');
    expect(siteFor(new URL('https://jiji.ng/mobile-phones'))).toBeNull();
    expect(siteFor(new URL('https://www.instagram.com/p/CxYz12/'))).toBe('instagram');
    expect(siteFor(new URL('https://www.instagram.com/adastores/'))).toBeNull();
  });
});

describe('findPrice', () => {
  it('reads naira and other currencies', () => {
    expect(findPrice('Price ₦450,000 negotiable')).toEqual({ amount: '450000', currency: 'NGN' });
    expect(findPrice('NGN 12500')).toEqual({ amount: '12500', currency: 'NGN' });
    expect(findPrice('Selling for N45,000 only')).toEqual({ amount: '45000', currency: 'NGN' });
    expect(findPrice('$120.50 shipped')).toEqual({ amount: '120.5', currency: 'USD' });
    expect(findPrice('25,000 naira')).toEqual({ amount: '25000', currency: 'NGN' });
    expect(findPrice('No price here, call 08012345678')).toBeUndefined();
    expect(findPrice('NIKE Air 42')).toBeUndefined();
  });
});

describe('extractListing', () => {
  it('Facebook: title from h1, price next to it', () => {
    const d = doc(`<html><head><title>Marketplace – iPhone 13 | Facebook</title><meta property="og:image" content="https://img/x.jpg"><meta property="og:description" content="UK used"></head>
      <body><div><div><h1>iPhone 13 Pro Max 256GB</h1><span>₦450,000</span></div></div><footer>₦1,000 delivery</footer></body></html>`);
    expect(extractListing(d, new URL('https://www.facebook.com/marketplace/item/1/'))).toMatchObject({
      site: 'Facebook Marketplace', title: 'iPhone 13 Pro Max 256GB', amount: '450000', currency: 'NGN', image: 'https://img/x.jpg', description: 'UK used', url: 'https://www.facebook.com/marketplace/item/1/',
    });
  });

  it('Jiji: uses schema.org Product data', () => {
    const d = doc(`<html><head><script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"Toyota Camry 2012","image":["https://jiji/car.jpg"],"offers":{"@type":"Offer","price":"6500000","priceCurrency":"NGN","seller":{"name":"Auto Hub"}}}</script></head><body><h1>Other</h1></body></html>`);
    expect(extractListing(d, new URL('https://jiji.ng/ikeja/cars/toyota-camry-2012-xyz.html'))).toMatchObject({ site: 'Jiji', title: 'Toyota Camry 2012', amount: '6500000', currency: 'NGN', image: 'https://jiji/car.jpg', seller: 'Auto Hub' });
  });

  it('Instagram: caption gives title, price and seller', () => {
    const d = doc(`<html><head><meta property="og:title" content='Ada Stores on Instagram: "Brand new Air Max 90, size 42. ₦65,000 Dm to order"'><meta property="og:image" content="https://ig/x.jpg"></head><body></body></html>`);
    expect(extractListing(d, new URL('https://www.instagram.com/p/Cabc123/'))).toMatchObject({ site: 'Instagram', seller: 'Ada Stores', title: 'Brand new Air Max 90, size 42', amount: '65000', currency: 'NGN' });
  });

  it('returns null away from listings', () => {
    expect(extractListing(doc('<h1>x</h1>'), new URL('https://www.facebook.com/marketplace/'))).toBeNull();
  });
});

describe('api helpers', () => {
  it('keeps the last JSON object when PHP printed output first', () => {
    expect(parseBody('<br/><b>Warning</b> {x}\n{"status":true,"data":{"a":"}{"}}')).toEqual({ status: true, data: { a: '}{' } });
    expect(parseBody('{"status":"success","data":{}}{"status":false,"message":"Bad"}')).toEqual({ status: false, message: 'Bad' });
    expect(parseBody('not json')).toBeNull();
  });

  it('reads the expiry from a JWT', () => {
    const payload = btoa(JSON.stringify({ exp: 1792931647 })).replace(/=+$/, '');
    expect(tokenExpiry(`x.${payload}.y`)).toBe(1792931647);
    expect(tokenExpiry('garbage')).toBe(0);
  });
});

describe('format', () => {
  it('formats money with symbols', () => {
    expect(money('350000.00', 'NGN')).toBe('₦350,000.00');
    expect(money('1,000.00', 'USD')).toBe('$1,000.00');
    expect(money(5, 'XOF')).toBe('5.00 XOF');
  });
  it('parses amounts and relative times', () => {
    expect(parseAmount('₦45,000')).toBe('45000');
    expect(timeAgo(new Date(Date.now() - 5 * 60 * 1000).toISOString())).toBe('5 min ago');
  });
});
