import { FieldValue, arrayUnion } from 'firebase/firestore';
console.log(arrayUnion('test') instanceof FieldValue);
