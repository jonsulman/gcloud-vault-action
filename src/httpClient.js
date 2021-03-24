const axios = require('axios');
const https = require('https');

async function request(url, method, payload, headers, vaultCert) {
  const config = {
    url,
    method,
    data: payload,
    headers: headers,
    httpsAgent: new https.Agent({ cert: vaultCert, rejectUnauthorized: false })
  };
  try {
    const response = await axios(config);
    return response;
  } catch (error) {
    console.error(error.message);
    return error.response;
  }
}

module.exports = request;