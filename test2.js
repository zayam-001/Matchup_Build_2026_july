import { FieldValue, serverTimestamp } from 'firebase/firestore';
console.log(serverTimestamp() instanceof FieldValue);
