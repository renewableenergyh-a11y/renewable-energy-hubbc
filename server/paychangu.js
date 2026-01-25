/**
 * Paychangu Payment Integration
 * Handles all payment processing through Paychangu API
 * Supports MTN Money, Airtel Money, and Card payments
 */

const crypto = require('crypto');
const https = require('https');

class PaychanguPayment {
  constructor(publicKey, secretKey) {
    this.publicKey = publicKey;
    this.secretKey = secretKey;
    this.apiUrl = 'https://api.paychangu.com';
    this.apiVersion = 'v1';
  }

  /**
   * Generate request signature for Paychangu
   */
  generateSignature(data) {
    const message = JSON.stringify(data);
    return crypto
      .createHmac('sha256', this.secretKey)
      .update(message)
      .digest('hex');
  }

  /**
   * Initiate payment request
   * @param {Object} paymentData - Payment details
   * @returns {Promise<Object>} - Paychangu response with payment URL
   */
  async initiatePayment(paymentData) {
    const {
      amount,
      currency = 'MWK',
      email,
      phoneNumber,
      firstName,
      lastName,
      description = 'Premium Subscription - Renewable Energy Hub',
      transactionId,
      paymentMethod = null,
    } = paymentData;

    if (!amount || !email || !transactionId) {
      throw new Error('Missing required fields: amount, email, transactionId');
    }

    const payload = {
      public_key: this.publicKey,
      tx_ref: transactionId,
      amount: amount.toString(),
      currency: currency,
      email: email,
      phone_number: phoneNumber || '',
      first_name: firstName || '',
      last_name: lastName || '',
      title: 'Premium Subscription',
      description: description,
      logo: 'https://renewableenergyhub.com/logo.png',
      callback_url: `${process.env.SERVER_URL || 'https://renewable-energy-hub2.onrender.com'}/api/paychangu/callback`,
      return_url: `${process.env.SITE_URL || 'https://renewable-energy-hub2.onrender.com'}/billing.html?payment=success`,
      customization: {
        title: 'Renewable Energy Hub',
        description: 'Premium Subscription Payment',
      },
    };

    // Add payment method if specified
    if (paymentMethod) {
      payload.payment_options = paymentMethod;
    }

    try {
      const response = await this.makeRequest('POST', `/payment`, payload);
      console.log('✅ Paychangu API response:', response);
      return response;
    } catch (err) {
      console.error('❌ Paychangu API error:', err.message);
      throw err;
    }
  }

  /**
   * Verify payment status
   * @param {string} transactionRef - Transaction reference ID
   * @returns {Promise<Object>} - Payment status from Paychangu
   */
  async verifyPayment(transactionRef) {
    if (!transactionRef) {
      throw new Error('Transaction reference is required');
    }

    // Build query string for GET request
    const queryParams = new URLSearchParams({
      public_key: this.publicKey,
      tx_ref: transactionRef,
    });

    return this.makeRequest('GET', `/transaction-verify?${queryParams.toString()}`, null);
  }

  /**
   * Make HTTP request to Paychangu API
   * @private
   */
  makeRequest(method, path, payload) {
    return new Promise((resolve, reject) => {
      const url = new URL(this.apiUrl + path);
      
      const options = {
        hostname: url.hostname,
        port: 443,
        path: url.pathname,
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.secretKey}`,
        },
      };

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          console.log(`Paychangu ${method} ${path} - Status: ${res.statusCode}`);
          console.log('Raw Response:', data.substring(0, 500));
          try {
            const response = JSON.parse(data);
            console.log('Parsed Response:', JSON.stringify(response, null, 2).substring(0, 500));
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(response);
            } else {
              reject(new Error(response.message || `API error: ${res.statusCode}`));
            }
          } catch (e) {
            console.error('Parse error:', e.message);
            reject(new Error(`Failed to parse response: ${e.message}`));
          }
        });
      });

      req.on('error', (e) => {
        console.error(`Request error for ${method} ${path}:`, e.message);
        reject(e);
      });

      console.log(`Making request: ${method} ${this.apiUrl}${path}`);
      if (payload) {
        req.write(JSON.stringify(payload));
      }
      req.end();
    });
  }
}

module.exports = PaychanguPayment;
