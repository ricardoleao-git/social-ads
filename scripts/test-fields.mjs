import "dotenv/config";
import { GoogleAdsApi } from "google-ads-api";

const client = new GoogleAdsApi({
  client_id: process.env.GOOGLE_ADS_CLIENT_ID,
  client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
  developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
});

const customer = client.Customer({
  customer_id: process.env.GOOGLE_ADS_CUSTOMER_ID || "3003291643",
  refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN,
  ...(process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID ? { login_customer_id: process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID } : {}),
});

const rows = await customer.query(`
  SELECT
    campaign.id,
    campaign.name,
    campaign_criterion.criterion_id,
    campaign_criterion.keyword.text,
    campaign_criterion.keyword.match_type,
    campaign_criterion.negative,
    campaign_criterion.resource_name
  FROM campaign_criterion
  WHERE campaign_criterion.negative = TRUE
    AND campaign_criterion.type = KEYWORD
    AND campaign.status != 'REMOVED'
  LIMIT 3
`);
console.log("Campos OK! Sample:");
console.log(JSON.stringify(rows[0], null, 2));
console.log(`Total: ${rows.length} rows`);
