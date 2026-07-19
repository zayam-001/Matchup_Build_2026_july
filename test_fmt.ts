import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyB8JUYv4EMtbe_K-8A8_nxdZu-VJXbVSgw",
  authDomain: "tournament-scoring-app-7dff5.firebaseapp.com",
  projectId: "tournament-scoring-app-7dff5",
  storageBucket: "tournament-scoring-app-7dff5.firebasestorage.app",
  messagingSenderId: "620668510760",
  appId: "1:620668510760:web:2d037b31f2034e3da64b1d"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  const tid = "mD3BD4WWP0xeWDaXhA6Y";
  const snap = await getDoc(doc(db, "tournaments", tid));
  console.log("Format:", snap.data().format);
  process.exit(0);
}
run();
