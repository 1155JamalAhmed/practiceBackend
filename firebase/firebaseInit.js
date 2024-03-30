const admin = require("firebase-admin");

// Generate the Private Key from Firebase Project Settings -> Service Accounts
const serviceAccount = require(process.env.GOOGLE_APPLICATION_CREDENTIALS);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

exports.messaging = admin.messaging();
