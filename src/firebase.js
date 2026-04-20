import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// 여기에 Firebase 콘솔에서 복사한 firebaseConfig를 붙여넣으세요
// (기존 math-war 프로젝트의 config를 그대로 사용하시면 됩니다)
const firebaseConfig = {
  apiKey: "AIzaSyB1NismWRDIYt5PWpf1vqUfYwgMNDoQdRU",
  authDomain: "math-war-8868b.firebaseapp.com",
  projectId: "math-war-8868b",
  storageBucket: "math-war-8868b.firebasestorage.app",
  messagingSenderId: "930399097039",
  appId: "1:930399097039:web:165a78217313296466a7ba"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
