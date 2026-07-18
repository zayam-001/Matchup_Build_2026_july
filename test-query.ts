import { initializeApp } from 'firebase/app';
import { getFirestore, doc, updateDoc } from 'firebase/firestore';

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
  try {
    console.log("Updating Tournament N5diJXYPPko1bR3XkOWc (Padel Pro Series 2.0)...");
    await updateDoc(doc(db, "tournaments", "N5diJXYPPko1bR3XkOWc"), {
      organizerEmail: "eventletics.business@gmail.com",
      adminTag: "eventletics.business@gmail.com",
      organizerId: "E3r8tMCukSeN0mKEiRokTNuzL1a2"
    });
    console.log("Successfully updated Padel Pro Series 2.0!");

    console.log("Updating Tournament 8epSjX38LI0eFbxBo2hF (Under 14 - Padel Duo Challenge)...");
    await updateDoc(doc(db, "tournaments", "8epSjX38LI0eFbxBo2hF"), {
      organizerEmail: "taha.nadeem@maidan.pk",
      adminTag: "taha.nadeem@maidan.pk",
      organizerId: "xQPb2AdJV0Yd85SGZ3tiDmBCHLi2"
    });
    console.log("Successfully updated Under 14 - Padel Duo Challenge!");

  } catch (e) {
    console.error("Error during update:", e);
  }
}

run();
