import { describe, it, expect } from 'vitest';
import { GoogleAuth } from 'google-auth-library';

describe('GA4 Service Account Credentials', () => {
  it('should have GA4_SERVICE_ACCOUNT_JSON configured', () => {
    const json = process.env.GA4_SERVICE_ACCOUNT_JSON;
    expect(json).toBeTruthy();
    
    const parsed = JSON.parse(json!);
    expect(parsed.type).toBe('service_account');
    expect(parsed.client_email).toContain('ga4-analytics-reader');
    expect(parsed.private_key).toContain('BEGIN PRIVATE KEY');
  });

  it('should have GA4_PROPERTY_ID configured', () => {
    const propertyId = process.env.GA4_PROPERTY_ID;
    expect(propertyId).toBeTruthy();
  });

  it('should be able to create a GoogleAuth client with the credentials', async () => {
    const json = process.env.GA4_SERVICE_ACCOUNT_JSON;
    expect(json).toBeTruthy();
    
    const credentials = JSON.parse(json!);
    const auth = new GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
    });
    
    // This will validate the credentials format without making an API call
    const client = await auth.getClient();
    expect(client).toBeTruthy();
  });
});
