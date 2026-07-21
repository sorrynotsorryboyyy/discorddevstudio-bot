import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Projet Firebase dédié à DDS Bot (JSON du compte de service encodé en base64)
export function db() {
  if (getApps().length === 0) {
    const encoded = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (!encoded) {
      throw new Error(
        "Variable FIREBASE_SERVICE_ACCOUNT_KEY manquante (JSON du compte de service en base64)."
      );
    }
    const serviceAccount = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
    initializeApp({ credential: cert(serviceAccount) });
    getFirestore().settings({ ignoreUndefinedProperties: true });
  }
  return getFirestore();
}
