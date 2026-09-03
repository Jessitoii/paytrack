import { describe, it, expect } from 'vitest';
import { categorizeTransaction } from '../../src/services/bank/categorizer';

describe('Smart Bank Transaction Categorizer & Rent Matching', () => {
  it('categorizes Albert Heijn as Food/Groceries', () => {
    const res = categorizeTransaction({
      amount: -28.45,
      creditorName: 'Albert Heijn 1452 Bleiswijk',
      remittanceInformation: 'Betaalautomaat 12:44 Pasnr 012',
    });
    expect(res.categoryId).toBe('cat_food');
    expect(res.isRentMatch).toBe(false);
  });

  it('categorizes Jumbo Supermarkten as Food', () => {
    const res = categorizeTransaction({
      amount: -45.1,
      creditorName: 'Jumbo Supermarkt',
    });
    expect(res.categoryId).toBe('cat_food');
  });

  it('categorizes NS Reizigers as Transportation', () => {
    const res = categorizeTransaction({
      amount: -14.6,
      creditorName: 'NS Groep N.V.',
      remittanceInformation: 'OV-chipkaart automatisch opladen',
    });
    expect(res.categoryId).toBe('cat_transp');
    expect(res.isRentMatch).toBe(false);
  });

  it('categorizes Kruidvat as Health', () => {
    const res = categorizeTransaction({
      amount: -12.49,
      creditorName: 'Kruidvat Retail B.V.',
    });
    expect(res.categoryId).toBe('cat_health');
  });

  it('categorizes HollandZorg as Health', () => {
    const res = categorizeTransaction({
      amount: -38.01,
      remittanceInformation: 'Premie HollandZorg zorgverzekering weekinhouding',
    });
    expect(res.categoryId).toBe('cat_health');
  });

  it('categorizes Bol.com as Shopping', () => {
    const res = categorizeTransaction({
      amount: -39.99,
      creditorName: 'Bol.com B.V.',
    });
    expect(res.categoryId).toBe('cat_shopping');
  });

  it('categorizes Spotify and Netflix as Subscriptions', () => {
    const spotify = categorizeTransaction({
      amount: -10.99,
      creditorName: 'Spotify AB',
    });
    expect(spotify.categoryId).toBe('cat_sub');

    const netflix = categorizeTransaction({
      amount: -15.99,
      creditorName: 'Netflix International B.V.',
    });
    expect(netflix.categoryId).toBe('cat_sub');
  });

  it('detects weekly €160 Rent transaction and flags isRentMatch = true', () => {
    const res = categorizeTransaction({
      amount: -160.0,
      bookingDate: '2026-08-31', // Monday
      creditorName: 'Huisvesting Bleiswijk',
      remittanceInformation: 'Wekelijkse huur week 35',
    });
    expect(res.categoryId).toBe('cat_housing');
    expect(res.isRentMatch).toBe(true);
  });

  it('detects €160 with Turkish/Dutch rent text as Rent match', () => {
    const res = categorizeTransaction({
      amount: -160.0,
      creditorName: 'Ev Sahibi Kira Odeme',
      remittanceInformation: 'Kira haftalik',
    });
    expect(res.categoryId).toBe('cat_housing');
    expect(res.isRentMatch).toBe(true);
  });

  it('does NOT flag €160 MediaMarkt purchase as rent, correctly classifying as Shopping', () => {
    const res = categorizeTransaction({
      amount: -160.0,
      bookingDate: '2026-08-31', // Monday
      creditorName: 'MediaMarkt Rotterdam',
      remittanceInformation: 'Betaalautomaat MediaMarkt Pasnr 012',
    });
    expect(res.categoryId).toBe('cat_shopping');
    expect(res.isRentMatch).toBe(false);
  });

  it('does NOT flag €160 Zara purchase as rent, correctly classifying as Shopping', () => {
    const res = categorizeTransaction({
      amount: -160.0,
      bookingDate: '2026-08-31', // Monday
      creditorName: 'Zara Nederland B.V.',
      remittanceInformation: 'Kleding aankoop',
    });
    expect(res.categoryId).toBe('cat_shopping');
    expect(res.isRentMatch).toBe(false);
  });

  it('does NOT flag €160 on a Wednesday without rent text as rent match', () => {
    const res = categorizeTransaction({
      amount: -160.0,
      bookingDate: '2026-09-02', // Wednesday
      creditorName: 'John Doe',
      remittanceInformation: 'Lening terugbetaling',
    });
    expect(res.isRentMatch).toBe(false);
  });

  it('does NOT flag non-160 housing bill as rent match (e.g. €45 water/huur service cost)', () => {
    const res = categorizeTransaction({
      amount: -45.0,
      creditorName: 'Huurdersvereniging',
      remittanceInformation: 'Servicekosten huur',
    });
    expect(res.categoryId).toBe('cat_housing');
    expect(res.isRentMatch).toBe(false);
  });

  it('falls back to cat_other for unknown transactions', () => {
    const res = categorizeTransaction({
      amount: -8.5,
      creditorName: 'Random Local Shop 9821',
      remittanceInformation: 'Overboeking',
    });
    expect(res.categoryId).toBe('cat_other');
    expect(res.isRentMatch).toBe(false);
  });
});
