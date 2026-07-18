import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, signInAnonymously, createUserWithEmailAndPassword, signInWithEmailAndPassword, updatePassword, setPersistence, browserLocalPersistence, browserSessionPersistence } from 'firebase/auth';
import { 
    getFirestore, 
    initializeFirestore,
    persistentLocalCache,
    persistentMultipleTabManager,
    memoryLocalCache,
    collection, 
    doc, 
    addDoc, 
    setDoc,
    updateDoc, 
    deleteDoc, 
    onSnapshot, 
    getDoc, 
    getDocs,
    writeBatch,
    query, 
    where,
    orderBy,
    deleteField,
    increment,
    arrayUnion,
    limit,
    runTransaction,
    serverTimestamp,
    FieldValue,
    Timestamp
} from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { 
    Tournament, 
    Team, 
    Match, 
    MatchStatus, 
    ScoreState, 
    RegistrationStatus, 
    TournamentFormat, 
    RoundRobinType, 
    MatchDependency,
    Sponsor,
    MatchRating,
    PlayerProfile,
    SkillLevel,
    QuickSession,
    QuickMatch,
    Venue,
    Organizer,
    AutoScheduleConfig,
    SchedulingSlot,
    Player,
    OnboardedPlayer,
    OnboardedTeam
} from '../types';

// ==================================================================
// ⚙️ CONFIGURATION
// ==================================================================

const firebaseConfig = {
  apiKey: "AIzaSyB8JUYv4EMtbe_K-8A8_nxdZu-VJXbVSgw",
  authDomain: "tournament-scoring-app-7dff5.firebaseapp.com",
  projectId: "tournament-scoring-app-7dff5",
  storageBucket: "tournament-scoring-app-7dff5.firebasestorage.app",
  messagingSenderId: "620668510760",
  appId: "1:620668510760:web:2d037b31f2034e3da64b1d"
};

export let db: any = null;
export let auth: any = null;
export let storage: any = null;
let isMock = false;

try {
    const app = initializeApp(firebaseConfig);
    
    // Enable offline persistence and fix connection issues in sandboxed environments
    try {
        db = initializeFirestore(app, {
          experimentalForceLongPolling: true,
          localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
        });
    } catch (e: any) {
        if (e.message && e.message.includes('already been called')) {
            db = getFirestore(app);
        } else {
            console.warn("⚠️ Failed to initialize persistent local cache. Falling back to memory local cache.", e);
            try {
                db = initializeFirestore(app, {
                    experimentalForceLongPolling: true,
                    localCache: memoryLocalCache()
                });
            } catch (err: any) {
                if (err.message && err.message.includes('already been called')) {
                    db = getFirestore(app);
                } else {
                    throw err;
                }
            }
        }
    }
    
    auth = getAuth(app);
    storage = getStorage(app);
    console.log("🔥 Connected to Firebase Firestore and Storage");
} catch (e) {
    console.error("Firebase Init Error:", e);
    console.warn("⚠️ Falling back to Mock Storage due to error");
    isMock = true;
}

export const isConfigured = !isMock;

// ------------------------------------------------------------------
// ERROR HANDLING
// ------------------------------------------------------------------

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string;
    providerInfo?: any[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid,
      email: auth?.currentUser?.email,
      emailVerified: auth?.currentUser?.emailVerified,
      isAnonymous: auth?.currentUser?.isAnonymous,
      tenantId: auth?.currentUser?.tenantId,
      providerInfo: auth?.currentUser?.providerData?.map((provider: any) => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// ------------------------------------------------------------------
// UTILS
// ------------------------------------------------------------------
const cleanData = (data: any) => {
    const seen = new WeakMap();

    const clone = (obj: any): any => {
        if (obj === null || typeof obj !== 'object') {
            return obj === undefined ? null : obj;
        }
        if (obj instanceof Date) return obj.toISOString();
        if (obj instanceof RegExp) return obj.toString();
        if (obj instanceof FieldValue || obj instanceof Timestamp) return obj;

        // Safety blocks
        if (obj.nodeType || obj.$$typeof || (obj.constructor && obj.constructor.name && (obj.constructor.name.startsWith('_') || obj.constructor.name === 'SyntheticBaseEvent'))) {
            return null; 
        }

        if (seen.has(obj)) return null;
        seen.set(obj, true);

        if (Array.isArray(obj)) return obj.map(item => clone(item));

        const output: any = {};
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                const val = clone(obj[key]);
                if (val !== undefined) output[key] = val;
            }
        }
        return output;
    };

    return clone(data);
};

const deepClone = <T>(obj: T): T => {
    return cleanData(obj) as T;
};

// ------------------------------------------------------------------
// MOCK STORAGE STATE
// ------------------------------------------------------------------
let mockTournaments: Tournament[] = [];
const listeners: ((data: Tournament[]) => void)[] = [];
const tournamentListeners: {id: string, cb: (data: Tournament | null) => void}[] = [];

const notifyMock = () => {
    const safeData = cleanData(mockTournaments);
    listeners.forEach(l => l(safeData));
    tournamentListeners.forEach(tl => {
        const t = safeData.find((tour: Tournament) => tour.id === tl.id);
        tl.cb(t ? t : null);
    });
};

const genId = () => Math.random().toString(36).substr(2, 9);
const initialScore: ScoreState = {
  p1Points: '0', p2Points: '0', p1Games: 0, p2Games: 0, p1Sets: 0, p2Sets: 0,
  p1SetScores: [], p2SetScores: [], currentSet: 1, isTiebreak: false, history: [], timeline: []
};

const slugify = (text: string) => {
    return text
      .toString()
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')     // Replace spaces with -
      .replace(/[^\w-]+/g, '')  // Remove all non-word chars
      .replace(/--+/g, '-');    // Replace multiple - with single -
};

const createMatchObject = (tId: string, name: string, round: number, stage: 'GROUP'|'BRACKET'|'PLAYOFF', timeOffset: number, court: string, t1?: string, t2?: string): Match => {
    const sTime = new Date(new Date().getTime() + (timeOffset * 60 * 60 * 1000)).toISOString();
    return {
        id: genId(), tournamentId: tId, team1Id: t1 || '', team2Id: t2 || '',
        stage, round, roundName: name, 
        court: court || null, courtId: court || null, courtName: court || null,
        scheduledCourtId: court || null,
        scheduledStartTime: sTime,
        actualCourtId: null,
        courtOverrideBy: null,
        courtOverrideAt: null,
        conflictAcknowledged: null,
        obsEnabled: false, obsUrl: null,
        scheduledTime: sTime,
        status: MatchStatus.SCHEDULED, score: deepClone(initialScore)
    };
};

// ------------------------------------------------------------------
// HELPERS
// ------------------------------------------------------------------

// Helper to save sponsors to sub-collection
const saveSponsorsToSubCollection = async (tId: string, sponsors: Sponsor[]) => {
    if (!db) return;
    const batch = writeBatch(db);
    const sponsorsCollection = collection(db, "tournaments", tId, "sponsors");
    
    // Get existing to find deletions
    const existingSnaps = await getDocs(sponsorsCollection);
    const existingIds = existingSnaps.docs.map(d => d.id);
    const newIds = sponsors.map(s => s.id);

    // Delete removed sponsors
    existingSnaps.docs.forEach(d => {
        if (!newIds.includes(d.id)) {
            batch.delete(d.ref);
        }
    });

    // Set/Update new sponsors
    sponsors.forEach(s => {
        // Ensure ID
        const id = s.id || genId();
        const ref = doc(sponsorsCollection, id);
        batch.set(ref, { ...s, id }, { merge: true });
    });

    await batch.commit();
};

// ------------------------------------------------------------------
// AUTH & PLAYER IDENTITY (MOCK)
// ------------------------------------------------------------------

export const registerPlayer = async (data: any) => {
    if (!auth) throw new Error("Firebase not initialized");
    
    // 1. Create user in Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
    const user = userCredential.user;

    let pointsEarned = 0;
    let referredBy = null;
    
    if (data.promoCode && db) {
      const promoRef = doc(db, 'promoCodes', data.promoCode);
      const promoSnap = await getDoc(promoRef);
      if (promoSnap.exists()) {
        const promoData = promoSnap.data();
        const uniqueSignUps = promoData.uniqueSignUps || [];
        if (!uniqueSignUps.includes(user.uid)) {
          referredBy = data.promoCode;
          await updateDoc(promoRef, {
            uniqueSignUps: arrayUnion(user.uid),
            pointsEarned: increment(100)
          });
        }
      }
    }

    const newPlayer = {
        id: user.uid,
        fullName: data.name,
        email: data.email,
        phone: data.phone,
        cnic: data.cnic || '',
        gender: data.gender || 'male',
        role: 'player',
        stats: {
            matchesPlayed: 0,
            wins: 0,
            losses: 0,
            setsWon: 0,
            eloRating: 1000
        },
        firstMiniTournamentUsed: false,
        promoCode: null,
        promoPoints: 0,
        referredBy,
        createdAt: new Date().toISOString()
    };
    
    if (db) {
        try {
            // 2. Store the user's data in the 'players' collection
            const playerRef = doc(db, 'players', newPlayer.id);
            await setDoc(playerRef, newPlayer, { merge: true });
            await syncSingleStandalonePlayerToGlobal(newPlayer);

            // Increment global players
            const globalRef = doc(db, 'globalStats', 'singleton');
            await setDoc(globalRef, { totalPlayers: increment(1) }, { merge: true });

            // 3. Trigger the welcome email by adding a document to the 'mail' collection
            const mailCollection = collection(db, 'mail');
            await addDoc(mailCollection, {
                to: newPlayer.email,
                message: {
                    subject: "Welcome to Match Up!",
                    from: "Match Up <info@matchup.com.pk>",
                    replyTo: "info@matchup.com.pk",
                    headers: {
                        'X-Priority': '1 (Highest)',
                        'Importance': 'high'
                    },
                    html: `
                        <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; background-color: #ffffff;">
                            
                            <!-- Header Logo -->
                            <div style="text-align: center; margin-bottom: 40px;">
                                <h2 style="margin: 0; color: #1e293b; font-size: 32px; font-weight: 900; letter-spacing: -1px;">Match-up</h2>
                            </div>

                            <!-- Greeting -->
                            <div style="text-align: center; margin-bottom: 30px;">
                                <h1 style="font-size: 36px; color: #333; margin: 0; font-weight: 800; line-height: 1.2;">
                                    Hey ${newPlayer.fullName},<br/>
                                    welcome on board!
                                </h1>
                            </div>

                            <!-- Hero Image -->
                            <div style="margin-bottom: 40px; text-align: center;">
                                <img src="https://firebasestorage.googleapis.com/v0/b/tournament-scoring-app-7dff5.firebasestorage.app/o/Gemini_Generated_Image_dfxqwxdfxqwxdfxq.png?alt=media&token=6fa34fbf-ba1e-4c45-948c-e5d18174daaa" alt="Welcome Onboard" style="width: 100%; max-width: 600px; border-radius: 12px;" />
                            </div>

                            <!-- Body Text -->
                            <div style="font-size: 18px; line-height: 1.6; color: #444; padding: 0 20px; text-align: left;">
                                <p style="margin-top: 0; margin-bottom: 20px;">Welcome to the Match Up platform. We are excited to have you! Your global sports identity is now active. You can start registering for tournaments, managing your squads, and tracking your stats.</p>
                                <p style="margin-bottom: 0;">We're here to make your experience amazing. If you have any questions or feedback, feel free to reply to this email, we'd love to hear from you!</p>
                                <div style="margin-top: 30px; text-align: center;"><a href="https://matchup.com.pk" style="background-color: #4D78FF; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 16px;">Go to Match Up</a></div>
                            </div>

                            <!-- Divider -->
                            <hr style="border: none; border-top: 1px solid #eee; margin: 60px 20px 40px;" />

                            <!-- Footer -->
                            <div style="text-align: left; font-size: 14px; color: #666; line-height: 1.6; padding: 0 20px;">
                                <h3 style="margin: 0 0 10px; color: #333; font-size: 18px; font-weight: 600;">Match Up</h3>
                                <p style="margin: 0 0 20px;">National Incubation Center, NED University, Karachi</p>
                                
                                <p style="margin: 0 0 5px;">This email was sent to <a href="mailto:${newPlayer.email}" style="color: #4f46e5; text-decoration: none;">${newPlayer.email}</a>.</p>
                                <p style="margin: 0 0 20px;">You've received this email because you've subscribed to our newsletter.</p>
                                
                                <a href="#" style="color: #666; text-decoration: underline;">Unsubscribe</a>
                            </div>
                        </div>
                    `
                }
            });
        } catch (error) {
            console.error("Error saving player to Firestore or sending email:", error);
        }
    }
    
    return newPlayer;
};

export const setPlayerPersistence = async (rememberMe: boolean) => {
    if (!auth) return;
    await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
};

export const loginPlayer = async (email: string, password?: string) => {
    if (!auth) throw new Error("Firebase not initialized");
    if (!password) throw new Error("Password is required");
    
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    if (db) {
        try {
            const userRef = doc(db, 'players', user.uid);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
                return userSnap.data();
            }
        } catch (error) {
            console.error("Error fetching player from Firestore:", error);
        }
    }

    return user;
};

export const loginReferee = async () => {
    if (!auth) throw new Error("Firebase not initialized");
    return await signInAnonymously(auth);
};

export const loginOrganiser = async (email: string, password?: string) => {
    if (!auth) throw new Error("Firebase not initialized");
    if (!password) throw new Error("Password is required");
    
    // First, try signing in with Firebase
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        if (db) {
            const orgRef = doc(db, 'adminUsers', user.uid);
            let orgSnap = await getDoc(orgRef);
            
            if (orgSnap.exists()) {
                return { user, organiserData: orgSnap.data() };
            } else {
                // Fallback: check users collection
                const userRef = doc(db, 'users', user.uid);
                const userSnap = await getDoc(userRef);
                
                if (userSnap.exists()) {
                    const userData = userSnap.data();
                    if (userData.role === 'admin' || userData.role === 'organiser' || userData.role === 'referee') {
                        return { user, organiserData: userData };
                    }
                }
                
                // Fallback 2: Check by email in adminUsers just in case Control Tower uses email as ID
                const emailQuery = query(collection(db, 'adminUsers'), where('email', '==', user.email || email));
                const emailQuerySnap = await getDocs(emailQuery);
                if (!emailQuerySnap.empty) {
                    return { user, organiserData: emailQuerySnap.docs[0].data() };
                }

                // Fallback 3: Check by email in users collection
                const userEmailQuery = query(collection(db, 'users'), where('email', '==', user.email || email));
                const userEmailQuerySnap = await getDocs(userEmailQuery);
                if (!userEmailQuerySnap.empty) {
                    const userData = userEmailQuerySnap.docs[0].data();
                    if (userData.role === 'admin' || userData.role === 'organiser' || userData.role === 'referee') {
                        return { user, organiserData: userData };
                    }
                }

                throw new Error("No admin/staff record found for this account.");
            }
        }
        return { user, organiserData: null };
    } catch (e: any) {
        // Fallback or specific handling could go here. Let it throw to Auth.tsx.
        throw e;
    }
};

export const changeOrganiserPassword = async (newPassword: string) => {
    if (!auth || !auth.currentUser) throw new Error("No authenticated user");
    
    // Update password in Firebase Auth
    await updatePassword(auth.currentUser, newPassword);

    // Update Firestore to remove the mustChangePassword flag
    if (db) {
        const orgRef = doc(db, 'adminUsers', auth.currentUser.uid);
        await updateDoc(orgRef, { mustChangePassword: false });
    }
};

export const skipOrganiserPasswordChange = async () => {
    if (!auth || !auth.currentUser) throw new Error("No authenticated user");
    
    if (db) {
        const orgRef = doc(db, 'adminUsers', auth.currentUser.uid);
        await updateDoc(orgRef, { mustChangePassword: false });
    }
};

export const loginWithGoogle = async () => {
    if (!auth) throw new Error("Firebase not initialized");
    
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    
    // Check if user exists in our 'players' collection
    if (db) {
        const userRef = doc(db, 'players', user.uid);
        const userSnap = await getDoc(userRef);
        
        if (!userSnap.exists()) {
            return { user, isNewUser: true };
        }
    }
    
    return { user, isNewUser: false };
};

export const completeGoogleSignUp = async (user: any, data: any) => {
    if (!auth || !db) throw new Error("Firebase not initialized");

    if (data.password) {
        try {
            await updatePassword(user, data.password);
        } catch (e) {
            console.error("Failed to update password for Google user:", e);
            // We can continue even if password update fails
        }
    }

    let pointsEarned = 0;
    
    if (data.promoCode) {
      const promoRef = doc(db, 'promoCodes', data.promoCode);
      const promoSnap = await getDoc(promoRef);
      if (promoSnap.exists()) {
        const promoData = promoSnap.data();
        pointsEarned = promoData.pointsEarned || 100;
        
        await updateDoc(promoRef, {
          totalUses: increment(1),
          uniqueSignUps: arrayUnion(user.uid),
          pointsEarned: increment(100)
        });
      }
    }

    const userData = {
        id: user.uid,
        fullName: data.name || user.displayName || 'Google User',
        email: user.email,
        phone: data.phone || user.phoneNumber || '',
        cnic: data.cnic || '',
        gender: data.gender || 'male',
        role: 'player',
        stats: {
            matchesPlayed: 0,
            wins: 0,
            losses: 0,
            setsWon: 0,
            eloRating: parseInt(data.skillLevel) || 1000
        },
        firstMiniTournamentUsed: false,
        promoCode: data.promoCode || null,
        promoPoints: pointsEarned,
        createdAt: new Date().toISOString()
    };
    
    const userRef = doc(db, 'players', user.uid);
    await setDoc(userRef, userData);
    
    // Increment global players
    const globalRef = doc(db, 'globalStats', 'singleton');
    await setDoc(globalRef, { totalPlayers: increment(1) }, { merge: true });

    // Trigger the welcome email by adding a document to the 'mail' collection
    if (user.email) {
        const mailCollection = collection(db, 'mail');
        await addDoc(mailCollection, {
            to: user.email,
            message: {
                subject: "Welcome to Match Up!",
                from: "Match Up <info@matchup.com.pk>",
                replyTo: "info@matchup.com.pk",
                headers: {
                    'X-Priority': '1 (Highest)',
                    'Importance': 'high'
                },
                html: `
                    <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; background-color: #ffffff;">
                        <!-- Header Logo -->
                        <div style="text-align: center; margin-bottom: 30px;">
                            <h1 style="color: #4f46e5; margin: 0; font-size: 28px; letter-spacing: -0.5px;">Match Up</h1>
                        </div>
                        <!-- Hero Image -->
                        <div style="margin-bottom: 40px; text-align: center;">
                            <img src="https://firebasestorage.googleapis.com/v0/b/tournament-scoring-app-7dff5.firebasestorage.app/o/Gemini_Generated_Image_dfxqwxdfxqwxdfxq.png?alt=media&token=6fa34fbf-ba1e-4c45-948c-e5d18174daaa" alt="Welcome Onboard" style="width: 100%; max-width: 600px; border-radius: 12px;" />
                        </div>
                        <!-- Body Text -->
                        <div style="font-size: 18px; line-height: 1.6; color: #444; padding: 0 20px; text-align: left;">
                            <p style="margin-top: 0; margin-bottom: 20px;">Welcome to the Match Up platform. We are excited to have you! Your global sports identity is now active. You can start registering for tournaments, managing your squads, and tracking your stats.</p>
                            <p style="margin-bottom: 0;">We're here to make your experience amazing. If you have any questions or feedback, feel free to reply to this email, we'd love to hear from you!</p>
                            <div style="margin-top: 30px; text-align: center;"><a href="https://matchup.com.pk" style="background-color: #4D78FF; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 16px;">Go to Match Up</a></div>
                        </div>
                        <!-- Divider -->
                        <hr style="border: none; border-top: 1px solid #eee; margin: 60px 20px 40px;" />
                        <!-- Footer -->
                        <div style="text-align: left; font-size: 14px; color: #666; line-height: 1.6; padding: 0 20px;">
                            <h3 style="margin: 0 0 10px; color: #333; font-size: 18px; font-weight: 600;">Match Up</h3>
                            <p style="margin: 0 0 20px;">National Incubation Center, NED University, Karachi</p>
                            <p style="margin: 0 0 5px;">This email was sent to <a href="mailto:${user.email}" style="color: #4f46e5; text-decoration: none;">${user.email}</a>.</p>
                            <p style="margin: 0 0 20px;">You've received this email because you've subscribed to our newsletter.</p>
                            <a href="#" style="color: #666; text-decoration: underline;">Unsubscribe</a>
                        </div>
                    </div>
                `
            }
        });
    }
    
    return userData;
};

export const logoutPlayer = () => {
    localStorage.removeItem('player_session');
};

export const getCurrentPlayer = () => {
    const session = localStorage.getItem('player_session');
    if (!session) return null;
    
    try {
        const { id, timestamp } = JSON.parse(session);
        if (Date.now() - timestamp > 24 * 60 * 60 * 1000) { // 24h expiry
            localStorage.removeItem('player_session');
            return null;
        }
        
        const existing = JSON.parse(localStorage.getItem('matchup_players') || '[]');
        const player = existing.find((p: any) => p.id === id);
        
        // If we have a session but no player in cache, return a partial object
        // so the UI knows we are authenticated, then the component can fetch the full profile.
        if (!player) {
            return {
                id,
                name: 'Loading...',
                email: '',
                phone: '',
                skillLevel: SkillLevel.INTERMEDIATE,
                verified: false,
                isPartial: true // Flag to indicate this needs a full fetch
            } as any;
        }
        
        return player;
    } catch (e) {
        console.error("Error parsing player session:", e);
        return null;
    }
};

export const getPlayerById = async (id: string): Promise<PlayerProfile | null> => {
    // Check local cache first
    const existing = JSON.parse(localStorage.getItem('matchup_players') || '[]');
    const cached = existing.find((p: any) => p.id === id);
    if (cached) return cached;

    // Fetch from Firestore
    if (db) {
        try {
            const playerRef = doc(db, 'players', id);
            const playerSnap = await getDoc(playerRef);
            if (playerSnap.exists()) {
                const player = playerSnap.data() as PlayerProfile;
                
                // Update cache
                existing.push(player);
                localStorage.setItem('matchup_players', JSON.stringify(existing));
                
                return player;
            }
        } catch (error) {
            console.error("Error fetching player from Firestore:", error);
        }
    }
    
    return null;
};

export const subscribeToPlayer = (playerId: string, cb: (data: any) => void) => {
    if (!db) return () => {};
    const docRef = doc(db, 'players', playerId);
    return onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
            cb({ id: docSnap.id, ...docSnap.data() });
        }
    }, (error) => {
        handleFirestoreError(error, OperationType.GET, `players/${playerId}`);
    });
};

export const uploadProfilePicture = async (userId: string, file: File): Promise<string> => {
    if (!storage) throw new Error("Firebase Storage not initialized");
    const timestamp = Date.now();
    const storageRef = ref(storage, `profilePictures/${userId}_${timestamp}_${file.name}`);
    await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(storageRef);
    return downloadURL;
};

export const uploadSystemImage = async (folder: string, file: File): Promise<string> => {
    if (!storage) throw new Error("Firebase Storage not initialized");
    const timestamp = Date.now();
    const storageRef = ref(storage, `${folder}/${timestamp}_${file.name}`);
    await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(storageRef);
    return downloadURL;
};

export const updatePlayerProfile = async (playerId: string, updates: any) => {
    let updatedPlayer = null;
    const existing = JSON.parse(localStorage.getItem('matchup_players') || '[]');
    const index = existing.findIndex((p: any) => p.id === playerId);

    if (index > -1) {
        existing[index] = { ...existing[index], ...updates };
        localStorage.setItem('matchup_players', JSON.stringify(existing));
        updatedPlayer = existing[index];
    }

    if (db) {
        try {
            const playerRef = doc(db, 'players', playerId);
            await updateDoc(playerRef, updates);
            const userSnap = await getDoc(playerRef);
            if (userSnap.exists()) {
                updatedPlayer = userSnap.data();
                await syncSingleStandalonePlayerToGlobal(updatedPlayer);
            }
        } catch (error) {
            console.error("Error updating player in Firestore:", error);
        }
    }

    return updatedPlayer;
};

export const getPlayerSquads = (playerId: string) => {
    const squads = JSON.parse(localStorage.getItem('matchup_squads') || '[]');
    return squads.filter((s: any) => s.ownerId === playerId);
};

export const createSquad = async (squadData: any) => {
    const squads = JSON.parse(localStorage.getItem('matchup_squads') || '[]');
    const newSquad = {
        id: genId(),
        ...squadData,
        createdAt: new Date().toISOString()
    };
    squads.push(newSquad);
    localStorage.setItem('matchup_squads', JSON.stringify(squads));
    return newSquad;
};

export const deleteSquad = async (squadId: string) => {
    let squads = JSON.parse(localStorage.getItem('matchup_squads') || '[]');
    squads = squads.filter((s: any) => s.id !== squadId);
    localStorage.setItem('matchup_squads', JSON.stringify(squads));
};

export const rateMatchOpponent = async (tournamentId: string, matchId: string, rating: MatchRating) => {
    const tRef = doc(db, 'tournaments', tournamentId);
    const snap = await getDoc(tRef);
    if (!snap.exists()) return;
    
    const t = snap.data() as Tournament;
    const matchIndex = t.matches.findIndex(m => m.id === matchId);
    if (matchIndex === -1) return;
    
    const match = t.matches[matchIndex];
    if (match.status !== 'COMPLETED') {
        throw new Error("Can only rate completed matches");
    }
    
    if (!match.ratings) {
        match.ratings = [];
    }
    
    // Prevent duplicate ratings
    const existingIndex = match.ratings.findIndex(r => r.raterPlayerId === rating.raterPlayerId && r.ratedPlayerId === rating.ratedPlayerId);
    if (existingIndex > -1) {
        match.ratings[existingIndex] = rating;
    } else {
        match.ratings.push(rating);
    }
    
    t.matches[matchIndex] = match;
    await updateDoc(tRef, { matches: t.matches });
};

// ------------------------------------------------------------------
// EXPORT FUNCTIONS
// ------------------------------------------------------------------

export const subscribeToVenues = (cb: (data: Venue[]) => void) => {
    if (db) {
        const q = query(collection(db, "venues"), where("status", "==", "ACTIVE"));
        return onSnapshot(q, (snapshot: any) => {
            const venues = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as Venue));
            cb(venues);
        }, (error) => {
            handleFirestoreError(error, OperationType.LIST, "venues");
        });
    } else {
        // Mock fallback
        cb([]);
        return () => {};
    }
};

export const subscribeToTournaments = (cb: (data: Tournament[]) => void, organizerId?: string, organizerEmail?: string) => {
    if (db) {
        if (organizerId || organizerEmail) {
            // Fetch by organizerId, organizerEmail, and adminTag
            const qId = query(collection(db, "tournaments"), where("organizerId", "==", organizerId || ""));
            const qEmail = organizerEmail ? query(collection(db, "tournaments"), where("organizerEmail", "==", organizerEmail)) : null;
            const qTag = organizerEmail ? query(collection(db, "tournaments"), where("adminTag", "==", organizerEmail)) : null;

            let docsId: Tournament[] = [];
            let docsEmail: Tournament[] = [];
            let docsTag: Tournament[] = [];

            const emitMerged = () => {
                const mergedMap: Record<string, Tournament> = {};
                docsId.forEach(t => { mergedMap[t.id] = t; });
                docsEmail.forEach(t => { mergedMap[t.id] = t; });
                docsTag.forEach(t => { mergedMap[t.id] = t; });

                const tours = Object.values(mergedMap);
                tours.sort((a, b) => {
                    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                    return bTime - aTime;
                });
                cb(tours);
            };

            const unsubId = onSnapshot(qId, (snapshot: any) => {
                docsId = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as Tournament));
                emitMerged();
            }, (error) => {
                handleFirestoreError(error, OperationType.LIST, `tournaments-id-${organizerId}`);
            });

            const unsubEmail = qEmail ? onSnapshot(qEmail, (snapshot: any) => {
                docsEmail = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as Tournament));
                emitMerged();
            }, (error) => {
                handleFirestoreError(error, OperationType.LIST, `tournaments-email-${organizerEmail}`);
            }) : () => {};

            const unsubTag = qTag ? onSnapshot(qTag, (snapshot: any) => {
                docsTag = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as Tournament));
                emitMerged();
            }, (error) => {
                handleFirestoreError(error, OperationType.LIST, `tournaments-tag-${organizerEmail}`);
            }) : () => {};

            return () => {
                unsubId();
                unsubEmail();
                unsubTag();
            };
        } else {
            const q = query(collection(db, "tournaments"), where('status', 'in', ['ACTIVE', 'COMPLETED']));
            return onSnapshot(q, (snapshot: any) => {
                const tours = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as Tournament));
                tours.sort((a, b) => {
                    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                    return bTime - aTime;
                });
                cb(tours);
            }, (error) => {
                handleFirestoreError(error, OperationType.LIST, "tournaments");
            });
        }
    } else {
        let safeData = cleanData(mockTournaments);
        if (organizerId) {
            safeData = safeData.filter(t => t.organizerId === organizerId || (organizerEmail && (t.organizerEmail === organizerEmail || t.adminTag === organizerEmail)));
        }
        cb(safeData);
        const wrappedCb = (data: Tournament[]) => {
            let fd = cleanData(data);
            if (organizerId) {
                fd = fd.filter(t => t.organizerId === organizerId || (organizerEmail && (t.organizerEmail === organizerEmail || t.adminTag === organizerEmail)));
            }
            cb(fd);
        };
        listeners.push(wrappedCb);
        return () => { const idx = listeners.indexOf(wrappedCb); if (idx > -1) listeners.splice(idx, 1); };
    }
};

export const subscribeToTournament = (id: string, cb: (data: Tournament | null) => void) => {
    if (db) {
        let tData: Tournament | null = null;
        let sData: Sponsor[] = [];
        let mData: Match[] | null = null;
        let unsubS: any = null;
        let unsubM: any = null;
        
        const emit = () => {
            if (tData) {
                const finalData = { ...tData };
                finalData.sponsors = sData;
                if (mData && mData.length > 0) {
                    finalData.matches = mData;
                }
                cb(finalData);
            } else {
                cb(null);
            }
        };

        const setupSubcollections = (tId: string) => {
            if (unsubS) unsubS();
            if (unsubM) unsubM();

            unsubS = onSnapshot(collection(db, "tournaments", tId, "sponsors"), (snap) => {
                sData = snap.docs.map(d => ({ id: d.id, ...d.data() } as Sponsor));
                emit();
            });

            unsubM = onSnapshot(collection(db, "tournaments", tId, "matches"), (snap) => {
                mData = snap.docs.map(d => ({ id: d.id, ...d.data() } as Match));
                emit();
            });
        };

        // First, check if it's a direct ID
        const docRef = doc(db, "tournaments", id);
        const unsubT = onSnapshot(docRef, (snap) => {
            if (snap.exists()) {
                tData = { id: snap.id, ...snap.data() } as Tournament;
                setupSubcollections(snap.id);
                emit();
            } else {
                // If not found by ID, try searching by slug
                const q = query(collection(db, "tournaments"), where("slug", "==", id), limit(1));
                getDocs(q).then((slugSnap) => {
                    if (!slugSnap.empty) {
                        const d = slugSnap.docs[0];
                        // We still want to listen to the actual document for real-time updates
                        const actualDocRef = doc(db, "tournaments", d.id);
                        onSnapshot(actualDocRef, (realSnap) => {
                            if (realSnap.exists()) {
                                tData = { id: realSnap.id, ...realSnap.data() } as Tournament;
                                setupSubcollections(realSnap.id);
                                emit();
                            }
                        });
                    } else {
                        tData = null;
                        emit();
                    }
                });
            }
        });

        return () => { 
            unsubT(); 
            if (unsubS) unsubS(); 
            if (unsubM) unsubM(); 
        };
    } else {
        const t = mockTournaments.find(x => x.id === id || x.slug === id) || null;
        cb(t ? cleanData(t) : null);
        const listener = { id, cb };
        tournamentListeners.push(listener);
        return () => { const idx = tournamentListeners.indexOf(listener); if (idx > -1) tournamentListeners.splice(idx, 1); };
    }
};

export const getOrganiserCredits = async (uid: string) => {
    if (!db) {
        const stored = localStorage.getItem(`organizerCredits-${uid}`);
        if (stored) return JSON.parse(stored);
        return { matchCreditsRemaining: 100, matchCreditsUsed: 0 }; // Default mock
    }
    try {
        const docRef = doc(db, 'organisers', uid);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
            return snap.data();
        }
        return null; // Return null if active package doesn't exist
    } catch (err) {
        console.error("Failed to get organiser credits", err);
        return null;
    }
};

export const deductOrganiserCredits = async (uid: string, creditsToDeduct: number) => {
    if (!db) {
        const stored = localStorage.getItem(`organizerCredits-${uid}`);
        let data = stored ? JSON.parse(stored) : { matchCreditsRemaining: 100, matchCreditsUsed: 0 };
        if (data.matchCreditsRemaining < creditsToDeduct) return false;
        data.matchCreditsRemaining -= creditsToDeduct;
        data.matchCreditsUsed += creditsToDeduct;
        localStorage.setItem(`organizerCredits-${uid}`, JSON.stringify(data));
        return true;
    }
    try {
        const docRef = doc(db, 'organisers', uid);
        const snap = await getDoc(docRef);
        if (!snap.exists()) return false;
        
        const data = snap.data();
        const currentRemaining = data.matchCreditsRemaining || 0;
        const currentUsed = data.matchCreditsUsed || 0;
        
        if (currentRemaining < creditsToDeduct) {
            return false;
        }

        await updateDoc(docRef, {
            matchCreditsRemaining: currentRemaining - creditsToDeduct,
            matchCreditsUsed: currentUsed + creditsToDeduct
        });
        return true;
    } catch (err) {
        console.error("Failed to deduct credits", err);
        return false;
    }
};

export const refundOrganiserCredits = async (uid: string, creditsToRefund: number) => {
    if (!db) {
        const stored = localStorage.getItem(`organizerCredits-${uid}`);
        let data = stored ? JSON.parse(stored) : { matchCreditsRemaining: 100, matchCreditsUsed: 0 };
        data.matchCreditsRemaining += creditsToRefund;
        data.matchCreditsUsed = Math.max(0, data.matchCreditsUsed - creditsToRefund);
        localStorage.setItem(`organizerCredits-${uid}`, JSON.stringify(data));
        return true;
    }
    try {
        const docRef = doc(db, 'organisers', uid);
        const snap = await getDoc(docRef);
        if (!snap.exists()) return false;
        
        const data = snap.data();
        const currentRemaining = data.matchCreditsRemaining || 0;
        const currentUsed = data.matchCreditsUsed || 0;

        await updateDoc(docRef, {
            matchCreditsRemaining: currentRemaining + creditsToRefund,
            matchCreditsUsed: Math.max(0, currentUsed - creditsToRefund)
        });
        return true;
    } catch (err) {
        console.error("Failed to refund credits", err);
        return false;
    }
};

export const retireTournament = async (tId: string) => {
    if (db) {
        const tRef = doc(db, "tournaments", tId);
        await updateDoc(tRef, { status: 'RETIRED' });
    } else {
        const index = mockTournaments.findIndex(t => t.id === tId);
        if (index > -1) {
            mockTournaments[index].status = 'RETIRED';
            notifyMock();
        }
    }
};

export const createTournament = async (t: any) => {
    // Extract sponsors and matches to save separately
    const { sponsors, matches, ...mainData } = t;

    const newT: any = { 
        ...mainData, 
        teams: [], 
        // We don't save matches in the main doc anymore to keep it light
        matches: [], 
        status: 'ACTIVE', 
        slug: slugify(mainData.name || 'tournament'),
        createdAt: new Date().toISOString(),
        organizerId: t.organizerId || auth?.currentUser?.uid || '', // <--- Added organizerId
        organizerEmail: t.organizerEmail || auth?.currentUser?.email || '',
        adminTag: t.adminTag || auth?.currentUser?.email || ''
    };

    if (db) {
        // Save main doc
        const docRef = await addDoc(collection(db, "tournaments"), cleanData(newT));

        
        // Save sponsors to subcollection
        if (sponsors && sponsors.length > 0) {
            await saveSponsorsToSubCollection(docRef.id, sponsors);
        }

        // Save matches to subcollection (if any generated initially)
        if (matches && matches.length > 0) {
            const batch = writeBatch(db);
            const matchesCol = collection(db, "tournaments", docRef.id, "matches");
            matches.forEach((m: Match) => {
                const mRef = doc(matchesCol, m.id);
                batch.set(mRef, cleanData(m));
            });
            await batch.commit();
        }

        return docRef.id;
    } else {
        newT.id = genId();
        // For mock, we keep sponsors and matches inline
        if (sponsors) newT.sponsors = sponsors;
        if (matches) newT.matches = matches;
        mockTournaments = [newT, ...mockTournaments];
        notifyMock();
        return newT.id;
    }
};

export const updateTournament = async (tId: string, data: Partial<Tournament>) => {
    // Extract sponsors, matches, and teams to prevent overwriting them during settings update
    const { sponsors, matches, teams, ...mainData } = data;

    if (db) {
        const tRef = doc(db, "tournaments", tId);
        
        // Update main doc
        if (Object.keys(mainData).length > 0) {
            const updateObj: any = { ...cleanData(mainData), sponsors: deleteField() };
            if (mainData.name) {
                updateObj.slug = slugify(mainData.name);
            }
            await updateDoc(tRef, updateObj);
        } else {
            // Even if no main data update, ensure we clean legacy sponsors
             await updateDoc(tRef, { sponsors: deleteField() });
        }

        // Handle Sponsors Subcollection update if sponsors array is provided
        if (sponsors) {
            await saveSponsorsToSubCollection(tId, sponsors);
        }

        // Handle Matches Subcollection update if matches array is provided (e.g. from generateSchedule or manual update)
        // Note: Usually we update specific matches, but if a full list is provided, we might want to sync it.
        // For now, let's assume updateTournament is mostly for settings/metadata.
    } else {
        const t = mockTournaments.find(x => x.id === tId);
        if (t) {
            Object.assign(t, mainData);
            if (sponsors) t.sponsors = sponsors;
            if (matches) t.matches = matches;
            notifyMock();
        }
    }
};

export const deleteTournament = async (tId: string) => {
    if (db) {
        await deleteDoc(doc(db, "tournaments", tId));
        // Note: Subcollections are not automatically deleted in Firestore. 
    } else {
        mockTournaments = mockTournaments.filter(t => t.id !== tId);
        notifyMock();
    }
};

export const searchGlobalTeams = async (searchQuery: string): Promise<Team[]> => {
    if (!db) return [];
    try {
        const q = query(collection(db, "tournaments"));
        const snap = await getDocs(q);
        const allTeams: Team[] = [];
        const seenIds = new Set<string>();
        
        snap.forEach(doc => {
            const t = doc.data() as Tournament;
            if (t.teams) {
                t.teams.forEach(team => {
                    if (team.status === 'ACCEPTED' && !seenIds.has(team.id)) {
                        if (team.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            team.player1?.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            team.player2?.name?.toLowerCase().includes(searchQuery.toLowerCase())) {
                            
                            // Include source tournament ID so user knows where it's from
                            allTeams.push({ ...team, _sourceTournament: t.id } as any);
                            seenIds.add(team.id);
                        }
                    }
                });
            }
        });
        return allTeams.slice(0, 15); // Return top 15 results
    } catch (e) {
        console.error("Failed to search global teams", e);
        return [];
    }
};

export const verifyPlayerEmail = async (player: any) => {
    if (!db || !player || !player.email) return player;
    try {
        const playersRef = collection(db, 'players');
        const q = query(playersRef, where('email', '==', player.email.toLowerCase().trim()));
        const snap = await getDocs(q);
        if (!snap.empty) {
            return { ...player, verified: true };
        }
    } catch (e) {
        console.error("Error verifying player email", e);
    }
    return player;
};

export const registerTeam = async (tId: string, team: any) => {
    let { registeredBy, ...rest } = team;
    
    // Auto-verify players if accounts exist
    if (db) {
        rest.player1 = await verifyPlayerEmail(rest.player1);
        rest.player2 = await verifyPlayerEmail(rest.player2);
    }
    
    const newTeam = { ...rest, id: genId(), status: RegistrationStatus.PENDING, registeredAt: new Date().toISOString(), registeredBy: registeredBy || null };
    if (db) {
        const tRef = doc(db, "tournaments", tId);
        const snap = await getDoc(tRef);
        if (snap.exists()) {
            const tData = snap.data() as Tournament;
            await updateDoc(tRef, cleanData({ teams: [...(tData.teams||[]), newTeam] }));
            await syncTournamentPlayersAndTeams(tId);

            if (registeredBy) {
                try {
                    const referralsRef = collection(db, 'referrals');
                    await addDoc(referralsRef, {
                        referrerId: registeredBy,
                        tournamentId: tId,
                        teamName: newTeam.name,
                        p1Email: newTeam.player1?.email || '',
                        p2Email: newTeam.player2?.email || '',
                        createdAt: new Date().toISOString()
                    });
                } catch (e) {
                    console.error("Failed to add referral record", e);
                }
            }
        }
    } else {
        const t = mockTournaments.find(x => x.id === tId);
        if (t) { t.teams.push(newTeam); notifyMock(); }
        syncTournamentPlayersAndTeams(tId);
    }
};

export const enrollTeamManually = async (tId: string, team: Omit<Team, 'id' | 'status'>) => {
    let t = { ...team };
    if (db) {
        t.player1 = await verifyPlayerEmail(t.player1);
        t.player2 = await verifyPlayerEmail(t.player2);
    }
    const newTeam = { ...t, id: genId(), status: RegistrationStatus.ACCEPTED, registeredAt: new Date().toISOString() };
    if (db) {
        const tRef = doc(db, "tournaments", tId);
        const snap = await getDoc(tRef);
        if (snap.exists()) {
            const tData = snap.data() as Tournament;
            await updateDoc(tRef, cleanData({ teams: [...(tData.teams||[]), newTeam] }));
            await syncTournamentPlayersAndTeams(tId);

            // Send confirmation emails
            const mailCollection = collection(db, 'mail');
            const players = [newTeam.player1, newTeam.player2].filter(p => !!p.email);
            
            for (const player of players) {
                await addDoc(mailCollection, {
                    to: player.email,
                    message: {
                        subject: `Welcome to ${tData.name}!`,
                        from: "Match Up Tournaments <info@matchup.com.pk>",
                        html: `
                            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
                                ${tData.bannerUrl ? `<img src="${tData.bannerUrl}" alt="${tData.name}" style="width: 100%; border-radius: 12px; margin-bottom: 20px;" />` : ''}
                                        <h2>You're in!</h2>
                                        <p>Hi ${player.name},</p>
                                        <p>You have been successfully enrolled in <strong>${tData.name}</strong> as part of the team <strong>${newTeam.name}</strong>.</p>
                                        <p>Get ready for the matches!</p>
                                        <div style="margin-top: 30px; text-align: center;"><a href="https://matchup.com.pk" style="background-color: #4D78FF; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 16px;">Go to Match Up</a></div>
                                    </div>
                        `
                    }
                });
            }
        }
    } else {
        const t = mockTournaments.find(x => x.id === tId);
        if (t) { t.teams.push(newTeam as any); notifyMock(); }
        syncTournamentPlayersAndTeams(tId);
    }
    return newTeam.id;
};

export const updateTeamPlayers = async (tId: string, teamId: string, player1: Player, player2: Player) => {
    if (db) {
        const tRef = doc(db, "tournaments", tId);
        const snap = await getDoc(tRef);
        if (snap.exists()) {
            const tData = snap.data() as Tournament;
            const updatedTeams = (tData.teams || []).map(tm => tm.id === teamId ? { ...tm, player1, player2 } : tm);
            await updateDoc(tRef, cleanData({ teams: updatedTeams }));
            await syncTournamentPlayersAndTeams(tId);
        }
    } else {
        const t = mockTournaments.find(x => x.id === tId);
        if (t) {
            t.teams = t.teams.map((tm: any) => tm.id === teamId ? { ...tm, player1, player2 } : tm);
            notifyMock();
            syncTournamentPlayersAndTeams(tId);
        }
    }
};

export const updateTeamStatus = async (tId: string, teamId: string, status: string) => {
    if (db) {
        const tRef = doc(db, "tournaments", tId);
        const snap = await getDoc(tRef);
        if (snap.exists()) {
            const tData = snap.data() as Tournament;
            const updatedTeams = (tData.teams || []).map(tm => tm.id === teamId ? { ...tm, status: status as RegistrationStatus } : tm);
            await updateDoc(tRef, cleanData({ teams: updatedTeams }));
            await syncTournamentPlayersAndTeams(tId);

            if (status === RegistrationStatus.ACCEPTED) {
                const acceptedTeam = updatedTeams.find(tm => tm.id === teamId);
                if (acceptedTeam) {
                    const mailCollection = collection(db, 'mail');
                    const players = [acceptedTeam.player1, acceptedTeam.player2].filter(p => !!p?.email);
                    
                    for (const player of players) {
                        await addDoc(mailCollection, {
                            to: player.email,
                            message: {
                                subject: `Welcome to ${tData.name}!`,
                                from: "Match Up Tournaments <info@matchup.com.pk>",
                                html: `
                                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
                                        ${tData.bannerUrl ? `<img src="${tData.bannerUrl}" alt="${tData.name}" style="width: 100%; border-radius: 12px; margin-bottom: 20px;" />` : ''}
                                        <h2>You're in!</h2>
                                        <p>Hi ${player.name},</p>
                                        <p>Your team registration for <strong>${tData.name}</strong> has been accepted!</p>
                                        <p>Get ready for the matches!</p>
                                        <div style="margin-top: 30px; text-align: center;"><a href="https://matchup.com.pk" style="background-color: #4D78FF; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 16px;">Go to Match Up</a></div>
                                    </div>
                                `
                            }
                        });
                    }
                }
            }
        }
    } else {
        const t = mockTournaments.find(x => x.id === tId);
        if (t) {
            t.teams = t.teams.map(tm => tm.id === teamId ? { ...tm, status: status as RegistrationStatus } : tm);
            notifyMock();
            syncTournamentPlayersAndTeams(tId);
        }
    }
};

export const assignTeamGroup = async (tId: string, teamId: string, groupId: string) => {
    await updateTournamentTeamsGroups(tId, { [teamId]: groupId });
};

export const updateTournamentTeamsGroups = async (tId: string, updates: Record<string, string>) => {
    if (db) {
        const tRef = doc(db, "tournaments", tId);
        const snap = await getDoc(tRef);
        if (snap.exists()) {
            const tData = snap.data() as Tournament;
            let updatedTeams = [...(tData.teams || [])];
            for (const [teamId, groupId] of Object.entries(updates)) {
                 updatedTeams = updatedTeams.map(tm => tm.id === teamId ? { ...tm, groupId } : tm);
            }
            await updateDoc(tRef, cleanData({ teams: updatedTeams }));
            await syncTournamentPlayersAndTeams(tId);
            
            // Sync group change to standings subcollection
            for (const [teamId, groupId] of Object.entries(updates)) {
                const sRef = doc(db, "tournaments", tId, "standings", teamId);
                const sSnap = await getDoc(sRef);
                if (sSnap.exists()) {
                    await updateDoc(sRef, { groupId });
                }
            }
        }
    } else {
        const t = mockTournaments.find(x => x.id === tId);
        if (t) {
            for (const [teamId, groupId] of Object.entries(updates)) {
                 t.teams = t.teams.map(tm => tm.id === teamId ? { ...tm, groupId } : tm);
            }
            notifyMock();
        }
    }
};

// --- HELPER FUNCTIONS ---

const calculateSchedule = (tournament: Tournament, knockoutConfig?: any[], autoConfig?: AutoScheduleConfig): Match[] => {
    let teams = tournament.teams?.filter(t => t.status === RegistrationStatus.ACCEPTED) || [];
    if (autoConfig?.categoryId) {
        teams = teams.filter(t => t.categoryId === autoConfig.categoryId);
    }
    
    if (teams.length < 2) {
        console.warn('Not enough accepted teams to generate schedule for', autoConfig?.categoryId || 'tournament');
        return [];
    }

    const activeFormat = autoConfig?.categoryId 
        ? (tournament.categories?.find(c => c.id === autoConfig.categoryId)?.format || tournament.format) 
        : tournament.format;

    let matches: Match[] = [];
    let matchCounter = 1;

    // Helper for creating match object
    const createMatchBase = (t1Id: string | undefined, t2Id: string | undefined, round: number, roundName: string, stage: string): Match => {
        const t1 = t1Id && t1Id !== 'BYE' && t1Id !== '' ? tournament.teams?.find(t => t.id === t1Id) : null;
        const t2 = t2Id && t2Id !== 'BYE' && t2Id !== '' ? tournament.teams?.find(t => t.id === t2Id) : null;
        const initialTime = new Date().toISOString();
        
        return {
            id: `m_${Date.now()}_${matchCounter++}`,
            tournamentId: tournament.id,
            categoryId: autoConfig?.categoryId || undefined,
            team1Id: t1Id || '',
            team2Id: t2Id || '',
            team1Name: t1?.name || (t1Id === 'BYE' ? 'BYE' : ''),
            team2Name: t2?.name || (t2Id === 'BYE' ? 'BYE' : ''),
            team1PlayerNames: t1 ? [t1.player1?.name, t1.player2?.name].filter(Boolean).join(' & ') : '',
            team2PlayerNames: t2 ? [t2.player1?.name, t2.player2?.name].filter(Boolean).join(' & ') : '',
            status: MatchStatus.SCHEDULED,
            score: {
                p1Points: '0', p2Points: '0', p1Games: 0, p2Games: 0,
                p1Sets: 0, p2Sets: 0, p1SetScores: [], p2SetScores: [],
                currentSet: 1, isTiebreak: false, history: []
            },
            court: 'TBD',
            courtId: 'TBD',
            scheduledCourtId: 'TBD',
            scheduledStartTime: initialTime,
            actualCourtId: null,
            courtOverrideBy: null,
            courtOverrideAt: null,
            conflictAcknowledged: null,
            scheduledTime: initialTime,
            round,
            roundName,
            stage: stage
        };
    };

    if (activeFormat === TournamentFormat.SINGLE_ELIMINATION) {
        // Proper Single Elimination Bracket with seeding
        const sortedTeams = [...teams];
        if (autoConfig?.useSeeding) {
            // Sort by points or sets won as a proxy for seeding
            sortedTeams.sort((a, b) => (b.points || 0) - (a.points || 0));
        }

        const teamCount = sortedTeams.length;
        const nextPowerOf2 = Math.pow(2, Math.ceil(Math.log2(teamCount)));
        const byes = nextPowerOf2 - teamCount;

        const teamsWithByes: (Team | { id: 'BYE', name: 'BYE' })[] = [...sortedTeams];
        for (let i = 0; i < byes; i++) teamsWithByes.push({ id: 'BYE', name: 'BYE' } as any);

        // Seeding logic (1 vs 8, 4 vs 5, etc)
        const seededOrder: any[] = [];
        const n = teamsWithByes.length;
        for (let i = 0; i < n / 2; i++) {
            seededOrder.push(teamsWithByes[i]);
            seededOrder.push(teamsWithByes[n - 1 - i]);
        }

        const r1Matches: Match[] = [];
        for (let i = 0; i < seededOrder.length; i += 2) {
            const t1 = seededOrder[i];
            const t2 = seededOrder[i+1];
            
            const match = createMatchBase(t1.id === 'BYE' ? undefined : t1.id, t2.id === 'BYE' ? undefined : t2.id, 1, 'Round of ' + nextPowerOf2, 'KNOCKOUT');
            
            if (t1.id === 'BYE' || t2.id === 'BYE') {
                const winner = t1.id === 'BYE' ? t2 : t1;
                match.winnerTeamId = winner.id;
                match.status = MatchStatus.COMPLETED;
                match.roundName = 'Bye';
            }
            r1Matches.push(match);
        }
        matches = [...r1Matches];

        // Generate placeholders for next rounds
        let currentLevelMatches = matches;
        let roundNum = 2;
        while (currentLevelMatches.length > 1) {
            const nextLevelMatches: Match[] = [];
            for (let i = 0; i < currentLevelMatches.length; i += 2) {
                const m1 = currentLevelMatches[i];
                const m2 = currentLevelMatches[i+1];
                const nextM = createMatchBase(undefined, undefined, roundNum, `Round ${roundNum}`, 'KNOCKOUT');
                
                m1.nextMatchId = nextM.id;
                m2.nextMatchId = nextM.id;
                
                nextM.team1Dependency = { sourceType: 'MATCH_WINNER', sourceId: m1.id };
                nextM.team2Dependency = { sourceType: 'MATCH_WINNER', sourceId: m2.id };

                nextLevelMatches.push(nextM);
            }
            matches = [...matches, ...nextLevelMatches];
            currentLevelMatches = nextLevelMatches;
            roundNum++;
        }
        if (matches.length > 0) {
            const rounds = Array.from(new Set(matches.map(m => m.round))).sort((a,b) => b - a); // Highest round first
            let isFinal = true;
            for (const r of rounds) {
                const roundMatches = matches.filter(m => m.round === r);
                if (isFinal && roundMatches.length === 1) {
                    roundMatches[0].roundName = 'Final';
                    isFinal = false;
                } else if (roundMatches.length === 2) {
                    roundMatches[0].roundName = 'Semi-Final 1';
                    roundMatches[1].roundName = 'Semi-Final 2';
                } else if (roundMatches.length === 4) {
                    roundMatches.forEach((m, idx) => m.roundName = `Quarter-Final ${idx + 1}`);
                } else if (roundMatches.length === 8) {
                    roundMatches.forEach((m, idx) => m.roundName = `Round of 16 - Match ${idx + 1}`);
                } else {
                    roundMatches.forEach((m, idx) => m.roundName = `Round ${r} - Match ${idx + 1}`);
                }
            }
        }

    } else if (activeFormat === TournamentFormat.ROUND_ROBIN) {
        const rrType = autoConfig?.categoryId 
            ? (tournament.categories?.find((c: any) => c.id === autoConfig.categoryId)?.rrType || tournament.rrType) 
            : tournament.rrType;

        const getGroup = (t: Team) => t.groupId || 'A';
        const distinctGroups = Array.from(new Set(teams.map(getGroup)));
        
        // If there's more than 1 distinct group assigned by user, OR if the format type explicitly requests grouping, use group-based scheduling.
        if (distinctGroups.length > 1 || rrType === RoundRobinType.GROUP_SINGLE || rrType === RoundRobinType.GROUP_DOUBLE) {
            distinctGroups.forEach(group => {
                const groupTeams = teams.filter(t => getGroup(t) === group);
                for (let i = 0; i < groupTeams.length; i++) {
                    for (let j = i + 1; j < groupTeams.length; j++) {
                        matches.push(createMatchBase(groupTeams[i].id, groupTeams[j].id, 1, `Group ${group}`, 'GROUP'));
                        if (rrType === RoundRobinType.GROUP_DOUBLE || rrType === RoundRobinType.DOUBLE) {
                            matches.push(createMatchBase(groupTeams[j].id, groupTeams[i].id, 1, `Group ${group} (Reverse)`, 'GROUP'));
                        }
                    }
                }
            });
        } else {
            const rrTeams = [...teams];
            const groupName = distinctGroups.length === 1 ? `Group ${distinctGroups[0]}` : 'Round Robin';
            for (let i = 0; i < rrTeams.length; i++) {
                for (let j = i + 1; j < rrTeams.length; j++) {
                    matches.push(createMatchBase(rrTeams[i].id, rrTeams[j].id, 1, groupName, 'GROUP'));
                    if (rrType === RoundRobinType.DOUBLE) {
                        matches.push(createMatchBase(rrTeams[j].id, rrTeams[i].id, 1, `${groupName} (Reverse)`, 'GROUP'));
                    }
                }
            }
        }
    } else if (activeFormat === TournamentFormat.GROUP_TO_KNOCKOUT) {
        const rrType = autoConfig?.categoryId 
            ? (tournament.categories?.find(c => c.id === autoConfig.categoryId)?.rrType || tournament.rrType) 
            : tournament.rrType;
            
        const getGroup = (t: Team) => t.groupId || 'A';
        const groups = Array.from(new Set(teams.map(getGroup)));
        groups.forEach(group => {
            const groupTeams = teams.filter(t => getGroup(t) === group);
            for (let i = 0; i < groupTeams.length; i++) {
                for (let j = i + 1; j < groupTeams.length; j++) {
                    matches.push(createMatchBase(groupTeams[i].id, groupTeams[j].id, 1, `Group ${group}`, 'GROUP'));
                    if (rrType === RoundRobinType.GROUP_DOUBLE || rrType === RoundRobinType.DOUBLE) {
                        matches.push(createMatchBase(groupTeams[j].id, groupTeams[i].id, 1, `Group ${group} (Reverse)`, 'GROUP'));
                    }
                }
            }
        });

        if (groups.length === 4) {
            const knockoutStartRound = 2;
            const q1 = createMatchBase(undefined, undefined, knockoutStartRound, 'Quarter-Final 1', 'KNOCKOUT');
            q1.team1Dependency = { sourceType: 'GROUP_RANK', sourceId: groups[0], rank: 1 };
            q1.team2Dependency = { sourceType: 'GROUP_RANK', sourceId: groups[1], rank: 2 };

            const q2 = createMatchBase(undefined, undefined, knockoutStartRound, 'Quarter-Final 2', 'KNOCKOUT');
            q2.team1Dependency = { sourceType: 'GROUP_RANK', sourceId: groups[2], rank: 1 };
            q2.team2Dependency = { sourceType: 'GROUP_RANK', sourceId: groups[3], rank: 2 };

            const q3 = createMatchBase(undefined, undefined, knockoutStartRound, 'Quarter-Final 3', 'KNOCKOUT');
            q3.team1Dependency = { sourceType: 'GROUP_RANK', sourceId: groups[1], rank: 1 };
            q3.team2Dependency = { sourceType: 'GROUP_RANK', sourceId: groups[0], rank: 2 };

            const q4 = createMatchBase(undefined, undefined, knockoutStartRound, 'Quarter-Final 4', 'KNOCKOUT');
            q4.team1Dependency = { sourceType: 'GROUP_RANK', sourceId: groups[3], rank: 1 };
            q4.team2Dependency = { sourceType: 'GROUP_RANK', sourceId: groups[2], rank: 2 };

            const s1 = createMatchBase(undefined, undefined, knockoutStartRound + 1, 'Semi-Final 1', 'KNOCKOUT');
            s1.team1Dependency = { sourceType: 'MATCH_WINNER', sourceId: q1.id };
            s1.team2Dependency = { sourceType: 'MATCH_WINNER', sourceId: q2.id };
            q1.nextMatchId = s1.id;
            q2.nextMatchId = s1.id;

            const s2 = createMatchBase(undefined, undefined, knockoutStartRound + 1, 'Semi-Final 2', 'KNOCKOUT');
            s2.team1Dependency = { sourceType: 'MATCH_WINNER', sourceId: q3.id };
            s2.team2Dependency = { sourceType: 'MATCH_WINNER', sourceId: q4.id };
            q3.nextMatchId = s2.id;
            q4.nextMatchId = s2.id;

            const f = createMatchBase(undefined, undefined, knockoutStartRound + 2, 'Final', 'KNOCKOUT');
            f.team1Dependency = { sourceType: 'MATCH_WINNER', sourceId: s1.id };
            f.team2Dependency = { sourceType: 'MATCH_WINNER', sourceId: s2.id };
            s1.nextMatchId = f.id;
            s2.nextMatchId = f.id;
            
            matches = [...matches, q1, q2, q3, q4, s1, s2, f];
        } else if (groups.length >= 2) {
            const knockoutStartRound = 2;
            const s1 = createMatchBase(undefined, undefined, knockoutStartRound, 'Semi-Final 1', 'KNOCKOUT');
            s1.team1Dependency = { sourceType: 'GROUP_RANK', sourceId: groups[0], rank: 1 };
            s1.team2Dependency = { sourceType: 'GROUP_RANK', sourceId: groups[1%groups.length], rank: 2 };
            
            const s2 = createMatchBase(undefined, undefined, knockoutStartRound, 'Semi-Final 2', 'KNOCKOUT');
            s2.team1Dependency = { sourceType: 'GROUP_RANK', sourceId: groups[1%groups.length], rank: 1 };
            s2.team2Dependency = { sourceType: 'GROUP_RANK', sourceId: groups[0], rank: 2 };

            const f = createMatchBase(undefined, undefined, knockoutStartRound + 1, 'Final', 'KNOCKOUT');
            f.team1Dependency = { sourceType: 'MATCH_WINNER', sourceId: s1.id };
            f.team2Dependency = { sourceType: 'MATCH_WINNER', sourceId: s2.id };
            s1.nextMatchId = f.id;
            s2.nextMatchId = f.id;
            matches = [...matches, s1, s2, f];
        }
    } else if (activeFormat === TournamentFormat.AMERICANO || activeFormat === TournamentFormat.MEXICANO) {
        const rawPlayers = teams.map(t => ({ id: t.id, name: t.name }));
        const genIdStr = () => Math.random().toString(36).substr(2, 9);
        let matchCounter = 1;

        if (activeFormat === TournamentFormat.AMERICANO) {
            const N = rawPlayers.length;
            if (N < 4 || N % 4 !== 0) {
                throw new Error(`Total players must be a multiple of 4 (e.g., 4, 8, 12, 16) so no one sits out. Currently accepted: ${N}`);
            }

            // Shuffle/randomize the initial player setup
            const shuffledPlayers = [...rawPlayers].sort(() => Math.random() - 0.5);

            const totalRounds = N - 1;
            const matchesPerRound = N / 4;
            const mod = (val: number, n: number) => ((val % n) + n) % n;

            for (let r = 0; r < totalRounds; r++) {
                const R: typeof rawPlayers = new Array(N);
                R[0] = shuffledPlayers[0];
                for (let i = 1; i < N; i++) {
                    R[i] = shuffledPlayers[mod(i - 1 - r, N - 1) + 1];
                }

                for (let m = 0; m < matchesPerRound; m++) {
                    const pA1 = R[m];
                    const pA2 = R[N - 1 - m];
                    const pB1 = R[matchesPerRound + m];
                    const pB2 = R[N - 1 - matchesPerRound - m];

                    matches.push({
                        id: `m_americano_${genIdStr()}`,
                        tournamentId: tournament.id,
                        categoryId: autoConfig?.categoryId || undefined,
                        team1Id: `americano_temp_team_${matchCounter}_1`,
                        team2Id: `americano_temp_team_${matchCounter}_2`,
                        team1PlayerIds: [pA1.id, pA2.id],
                        team2PlayerIds: [pB1.id, pB2.id],
                        team1Name: `${pA1.name} & ${pA2.name}`,
                        team2Name: `${pB1.name} & ${pB2.name}`,
                        team1PlayerNames: '',
                        team2PlayerNames: '',
                        status: MatchStatus.SCHEDULED,
                        score: {
                            p1Points: '0', p2Points: '0', p1Games: 0, p2Games: 0,
                            p1Sets: 0, p2Sets: 0, p1SetScores: [], p2SetScores: [],
                            currentSet: 1, isTiebreak: false, history: []
                        },
                        court: 'TBD',
                        scheduledTime: new Date(Date.now() + (r + 1) * 30 * 60 * 1000).toISOString(),
                        round: r + 1,
                        roundName: `Round ${r + 1}`,
                        stage: 'GROUP'
                    });
                    matchCounter++;
                }
            }
        } else {
            const players = teams.map(t => ({ id: t.id, name: t.name }));
            while (players.length % 4 !== 0) {
                players.push({ id: `BYE_${players.length}`, name: 'BYE' });
            }
            // MEXICANO - Round 1 only (random pairing)
            const shuffledPlayers = [...players].sort(() => Math.random() - 0.5);
            for (let i = 0; i < shuffledPlayers.length; i += 4) {
                const p1 = shuffledPlayers[i];
                const p2 = shuffledPlayers[i + 1];
                const p3 = shuffledPlayers[i + 2];
                const p4 = shuffledPlayers[i + 3];

                matches.push({
                    id: `m_mexicano_${genIdStr()}`,
                    tournamentId: tournament.id,
                    categoryId: autoConfig?.categoryId || undefined,
                    team1Id: `mexicano_temp_team_${matchCounter}_1`,
                    team2Id: `mexicano_temp_team_${matchCounter}_2`,
                    team1PlayerIds: [p1.id, p2.id].filter(id => !id.startsWith('BYE')),
                    team2PlayerIds: [p3.id, p4.id].filter(id => !id.startsWith('BYE')),
                    team1Name: [p1, p2].map(p => p.name).filter(n => n !== 'BYE').join(' & '),
                    team2Name: [p3, p4].map(p => p.name).filter(n => n !== 'BYE').join(' & '),
                    team1PlayerNames: '',
                    team2PlayerNames: '',
                    status: MatchStatus.SCHEDULED,
                    score: {
                        p1Points: '0', p2Points: '0', p1Games: 0, p2Games: 0,
                        p1Sets: 0, p2Sets: 0, p1SetScores: [], p2SetScores: [],
                        currentSet: 1, isTiebreak: false, history: []
                    },
                    court: 'TBD',
                    scheduledTime: new Date().toISOString(),
                    round: 1,
                    roundName: `Round 1`,
                    stage: 'GROUP'
                });
                matchCounter++;
            }
        }
    }

    if (autoConfig && autoConfig.slots.length > 0) {
        const sortedMatches = matches.filter(m => m.status !== MatchStatus.COMPLETED);
        // Sort by stage (GROUP first, then KNOCKOUT) and round
        const dependencySorted = sortedMatches.sort((a, b) => {
            if (a.stage !== b.stage) return a.stage === 'GROUP' ? -1 : 1;
            return a.round - b.round;
        });
        
        const courts = autoConfig.courts.length > 0 ? autoConfig.courts : (tournament.courts || ['Court 1']);
        
        // Track the next available timestamp for each court
        const courtAvailability: Record<string, number> = {};
        // Track when each individual team or player finishes their last match
        const entityLastUnlocked: Record<string, number> = {};

        // Helper to retrieve all locked entity IDs for a match
        const getEntitiesInMatch = (m: Match): string[] => {
            if (m.team1PlayerIds && m.team1PlayerIds.length > 0) {
                return [...m.team1PlayerIds, ...(m.team2PlayerIds || [])].filter(id => id && id !== 'BYE' && !id.startsWith('BYE'));
            }
            return [m.team1Id, m.team2Id].filter(id => id && id !== 'BYE' && id !== '') as string[];
        };

        let currentMatchIndex = 0;
        
        for (let currentSlotIndex = 0; currentSlotIndex < autoConfig.slots.length; currentSlotIndex++) {
            const slot = autoConfig.slots[currentSlotIndex];
            const slotStart = new Date(`${slot.date}T${slot.startTime}`).getTime();
            const slotEnd = new Date(`${slot.date}T${slot.endTime}`).getTime();
            
            // Align court availability to slotStart if they are back in history
            courts.forEach(c => {
                if (!courtAvailability[c] || courtAvailability[c] < slotStart) {
                    courtAvailability[c] = slotStart;
                }
            });

            const durationMs = (autoConfig.matchDuration + autoConfig.bufferTime) * 60000;
            let scheduledAnythingThisPass = true;

            while (scheduledAnythingThisPass && currentMatchIndex < dependencySorted.length) {
                let matchToSchedule: Match | null = null;
                let bestMatchIndexInSorted = -1;
                let bestCourt = '';
                let bestStartTime = Infinity;

                // Look ahead in the remaining matches to find one with no current team/player conflicts
                for (let i = currentMatchIndex; i < dependencySorted.length; i++) {
                    const candidateMatch = dependencySorted[i];
                    const entities = getEntitiesInMatch(candidateMatch);

                    // Check which courts can fit this match
                    for (const court of courts) {
                        const earliestCourtStart = courtAvailability[court];
                        
                        // Calculate when BOTH teams/players are completely free
                        let earliestEntityStart = slotStart;
                        entities.forEach(entityId => {
                            if (entityLastUnlocked[entityId] && entityLastUnlocked[entityId] > earliestEntityStart) {
                                earliestEntityStart = entityLastUnlocked[entityId];
                            }
                        });

                        const candidateStartTime = Math.max(earliestCourtStart, earliestEntityStart);
                        if (candidateStartTime + durationMs <= slotEnd) {
                            if (candidateStartTime < bestStartTime) {
                                bestStartTime = candidateStartTime;
                                bestCourt = court;
                                matchToSchedule = candidateMatch;
                                bestMatchIndexInSorted = i;
                            }
                        }
                    }
                }

                if (matchToSchedule && bestCourt !== '') {
                    // Schedule this match!
                    const finalStartTime = new Date(bestStartTime).toISOString();
                    matchToSchedule.scheduledTime = finalStartTime;
                    matchToSchedule.scheduledStartTime = finalStartTime;
                    matchToSchedule.court = bestCourt;
                    matchToSchedule.courtId = bestCourt;
                    matchToSchedule.scheduledCourtId = bestCourt;
                    matchToSchedule.actualCourtId = null;
                    matchToSchedule.courtOverrideBy = null;
                    matchToSchedule.courtOverrideAt = null;
                    matchToSchedule.conflictAcknowledged = null;

                    const endTime = bestStartTime + durationMs;
                    courtAvailability[bestCourt] = endTime;

                    // Lock the entities so they don't play overlap games
                    const entities = getEntitiesInMatch(matchToSchedule);
                    entities.forEach(id => {
                        entityLastUnlocked[id] = endTime;
                    });

                    // Remove from candidates list and increment our schedule counter
                    dependencySorted.splice(bestMatchIndexInSorted, 1);
                } else {
                    scheduledAnythingThisPass = false;
                }
            }
        }
    }

    return matches;
};

const teamsNeedUpdate = (current: Team[], computed: Team[]): boolean => {
    if (current.length !== computed.length) return true;
    for (let i = 0; i < current.length; i++) {
        const c = current[i];
        const comp = computed.find(t => t.id === c.id);
        if (!comp) return true;
        if (
            (c.matchesPlayed || 0) !== (comp.matchesPlayed || 0) ||
            (c.wins || 0) !== (comp.wins || 0) ||
            (c.losses || 0) !== (comp.losses || 0) ||
            (c.points || 0) !== (comp.points || 0) ||
            (c.setsWon || 0) !== (comp.setsWon || 0) ||
            (c.setsLost || 0) !== (comp.setsLost || 0) ||
            (c.gamesWon || 0) !== (comp.gamesWon || 0) ||
            (c.gamesLost || 0) !== (comp.gamesLost || 0) ||
            (c.gwp || 0) !== (comp.gwp || 0)
        ) {
            return true;
        }
    }
    return false;
};

export const checkAndHealTournamentStats = async (tournament: Tournament, matches: Match[]) => {
    if (!db || !tournament || !matches || matches.length === 0) return;
    try {
        const computed = calculateStats(tournament.teams || [], matches, tournament.format);
        if (teamsNeedUpdate(tournament.teams || [], computed)) {
            const tId = tournament.id;
            const tRefStats = doc(db, "tournaments", tId);
            const statsBatch = writeBatch(db);
            statsBatch.update(tRefStats, cleanData({ teams: computed }));
            
            const standingsCol = collection(db, "tournaments", tId, "standings");
            computed.forEach(tea => {
                const sRef = doc(standingsCol, tea.id);
                if (tea.status === RegistrationStatus.ACCEPTED) {
                    statsBatch.set(sRef, cleanData(tea));
                } else {
                    statsBatch.delete(sRef);
                }
            });
            await statsBatch.commit();
            console.log(`Self-healed stats for tournament ${tId}`);
        }
    } catch (e) {
        console.error("Self-healing stats recalculation failed", e);
    }
};

const calculateStats = (teams: Team[], matches: Match[], format: TournamentFormat): Team[] => {
    if (!teams) return [];
    
    // Create a map for easy lookup and to avoid mutating original teams
    const teamMap = new Map<string, Team>();
    teams.forEach(t => {
        teamMap.set(t.id, {
            ...t,
            matchesPlayed: 0,
            wins: 0,
            losses: 0,
            ties: 0,
            points: 0,
            setsWon: 0,
            setsLost: 0,
            gamesWon: 0,
            gamesLost: 0,
            gamesPlayed: 0,
            pointsScored: 0,
            pointsConceded: 0,
            pointDifferential: 0,
            missedMatchPoints: 0,
            gwp: 0
        });
    });

    matches.forEach(m => {
        if (m.status !== MatchStatus.COMPLETED) return;

        // Knockout matches do not count towards standings according to international standards
        const stageUpper = m.stage?.toUpperCase();
        const isKnockout = stageUpper === "KNOCKOUT" || 
                          stageUpper === "PLAYOFF" ||
                          stageUpper === "BRACKET" ||
                          m.stage === "knockout" || 
                          m.stage === "brackets" ||
                          m.roundName?.toLowerCase().includes("final") || 
                          m.roundName?.toLowerCase().includes("semi") || 
                          m.roundName?.toLowerCase().includes("quarter") ||
                          m.roundName?.toLowerCase().includes("playoff") ||
                          m.roundName?.toLowerCase().includes("knockout") ||
                          m.roundName?.toLowerCase().includes("bracket") ||
                          m.roundName?.toLowerCase().includes("round of") ||
                          m.team1Dependency !== undefined ||
                          m.team2Dependency !== undefined ||
                          (m as any).isKnockout === true;
        
        if (isKnockout) return;

        // For round robin tournaments, only group stage matches count towards standings
        if (format === TournamentFormat.ROUND_ROBIN && stageUpper !== "GROUP") {
            return;
        }

        const mScore = (m.score || {}) as any;
        
        let p1Games = 0;
        let p2Games = 0;
        if (mScore.p1SetScores && mScore.p1SetScores.length > 0) {
            p1Games = mScore.p1SetScores.reduce((a: number, b: number) => a + b, 0);
            if (mScore.p1SetScores.length < (mScore.currentSet || 1)) {
                p1Games += (mScore.p1Games || 0);
            }
        } else {
            p1Games = mScore.p1Games || 0;
        }

        if (mScore.p2SetScores && mScore.p2SetScores.length > 0) {
            p2Games = mScore.p2SetScores.reduce((a: number, b: number) => a + b, 0);
            if (mScore.p2SetScores.length < (mScore.currentSet || 1)) {
                p2Games += (mScore.p2Games || 0);
            }
        } else {
            p2Games = mScore.p2Games || 0;
        }
        
        const isAmericano = format === TournamentFormat.AMERICANO || format === TournamentFormat.MEXICANO;
        const isT1Winner = m.winnerTeamId === m.team1Id;
        const isT2Winner = m.winnerTeamId === m.team2Id;

        const processTeamStats = (tId: string | undefined, tIsWinner: boolean, setsWon: number, setsLost: number, gamesWon: number, gamesLost: number, pointsToAdd: number) => {
            if (!tId) return;
            const t = teamMap.get(tId);
            if (!t) return;
            t.matchesPlayed = (t.matchesPlayed || 0) + 1;
            t.setsWon = (t.setsWon || 0) + setsWon;
            t.setsLost = (t.setsLost || 0) + setsLost;
            t.gamesWon = (t.gamesWon || 0) + gamesWon;
            t.gamesLost = (t.gamesLost || 0) + gamesLost;
            t.gamesPlayed = (t.gamesPlayed || 0) + gamesWon + gamesLost;
            
            if (tIsWinner) t.wins = (t.wins || 0) + 1;
            else if (!tIsWinner) t.losses = (t.losses || 0) + 1; // Assuming only strictly won/lost.
            
            t.points = (t.points || 0) + pointsToAdd;
        };

        if (format === TournamentFormat.AMERICANO || format === TournamentFormat.MEXICANO) {
            const t1Ids = m.team1PlayerIds || [];
            const t2Ids = m.team2PlayerIds || [];

            let isT1Winner = m.winnerTeamId === m.team1Id;
            let isT2Winner = m.winnerTeamId === m.team2Id;
            let isTie = false;

            if (p1Games > p2Games) {
                isT1Winner = true;
                isT2Winner = false;
            } else if (p2Games > p1Games) {
                isT1Winner = false;
                isT2Winner = true;
            } else {
                if (m.winnerTeamId === m.team1Id) {
                    isT1Winner = true;
                    isT2Winner = false;
                } else if (m.winnerTeamId === m.team2Id) {
                    isT1Winner = false;
                    isT2Winner = true;
                } else {
                    isT1Winner = true; // Hard fallback to avoid ties
                }
            }

            t1Ids.forEach(id => {
                const t = teamMap.get(id);
                if (!t) return;
                t.matchesPlayed = (t.matchesPlayed || 0) + 1;
                t.gamesWon = (t.gamesWon || 0) + p1Games;
                t.gamesLost = (t.gamesLost || 0) + p2Games;
                t.gamesPlayed = (t.gamesPlayed || 0) + p1Games + p2Games;
                
                t.pointsScored = (t.pointsScored || 0) + p1Games;
                t.pointsConceded = (t.pointsConceded || 0) + p2Games;
                t.pointDifferential = (t.pointDifferential || 0) + (p1Games - p2Games);
                
                if (isT1Winner) {
                    t.wins = (t.wins || 0) + 1;
                } else {
                    t.losses = (t.losses || 0) + 1;
                }
                
                t.points = (t.points || 0) + p1Games;
            });

            t2Ids.forEach(id => {
                const t = teamMap.get(id);
                if (!t) return;
                t.matchesPlayed = (t.matchesPlayed || 0) + 1;
                t.gamesWon = (t.gamesWon || 0) + p2Games;
                t.gamesLost = (t.gamesLost || 0) + p1Games;
                t.gamesPlayed = (t.gamesPlayed || 0) + p2Games + p1Games;
                
                t.pointsScored = (t.pointsScored || 0) + p2Games;
                t.pointsConceded = (t.pointsConceded || 0) + p1Games;
                t.pointDifferential = (t.pointDifferential || 0) + (p2Games - p1Games);
                
                if (isT2Winner) {
                    t.wins = (t.wins || 0) + 1;
                } else {
                    t.losses = (t.losses || 0) + 1;
                }
                
                t.points = (t.points || 0) + p2Games;
            });
        } else {
            processTeamStats(m.team1Id, isT1Winner, mScore.p1Sets || 0, mScore.p2Sets || 0, p1Games, p2Games, isT1Winner ? 2 : 0);
            processTeamStats(m.team2Id, isT2Winner, mScore.p2Sets || 0, mScore.p1Sets || 0, p2Games, p1Games, isT2Winner ? 2 : 0);
        }
    });

    const calculatedTeams = Array.from(teamMap.values());
    
    // For Americano/Mexicano, calculate missed matches compensation (M+) after processing all matches
    if (format === TournamentFormat.AMERICANO || format === TournamentFormat.MEXICANO) {
        const maxMatchesPlayed = Math.max(...calculatedTeams.map(t => t.matchesPlayed || 0), 0);
        calculatedTeams.forEach(t => {
            const mp = t.matchesPlayed || 0;
            if (maxMatchesPlayed > 0 && mp < maxMatchesPlayed) {
                const missedCount = maxMatchesPlayed - mp;
                // compensatory award of +8 points per missed match or the player's own average points per match
                let avgPoints = 8;
                if (mp > 0) {
                    avgPoints = Math.round((t.pointsScored || 0) / mp);
                }
                t.missedMatchPoints = missedCount * avgPoints;
            } else {
                t.missedMatchPoints = 0;
            }
            t.points = (t.pointsScored || 0) + (t.missedMatchPoints || 0);
        });
    }

    calculatedTeams.forEach(t => {
        t.gwp = t.gamesPlayed && t.gamesPlayed > 0 ? (t.gamesWon || 0) / t.gamesPlayed * 100 : 0;
    });

    return calculatedTeams;
};

export const generateSchedule = async (tId: string, knockoutConfig?: any[], autoConfig?: AutoScheduleConfig) => {
    if (db) {
        const tRef = doc(db, "tournaments", tId);
        const snap = await getDoc(tRef);
        if (snap.exists()) {
            const tData = snap.data() as Tournament;
            const matches = calculateSchedule(tData, knockoutConfig, autoConfig);
            
            const batch = writeBatch(db);
            const matchesCol = collection(db, "tournaments", tId, "matches");
            
            const existing = await getDocs(matchesCol);
            
            let matchesToDelete = existing.docs;
            if (autoConfig?.categoryId) {
                matchesToDelete = existing.docs.filter(d => {
                    const data = d.data();
                    return data.categoryId === autoConfig.categoryId;
                });
            }

            matchesToDelete.forEach(d => {
                batch.delete(d.ref)
                const globalMatchRef = doc(db, "matches", d.id);
                batch.delete(globalMatchRef);
            });

            matches.forEach(m => {
                const mRef = doc(matchesCol, m.id);
                const globalMatchRef = doc(db, "matches", m.id);
                batch.set(mRef, cleanData(m));
                batch.set(globalMatchRef, cleanData({
                    ...m,
                    tournamentId: tId // Ensure this is present
                }));
            });
            
            // Calculate starting standings (all 0) and overwrite the standings collection
            const standingsCol = collection(db, "tournaments", tId, "standings");
            const existingStandings = await getDocs(standingsCol);
            
            let standingsToDelete = existingStandings.docs;
            if (autoConfig?.categoryId) {
                standingsToDelete = existingStandings.docs.filter(d => {
                    const data = d.data();
                    return data.categoryId === autoConfig.categoryId;
                });
            }
            standingsToDelete.forEach(d => batch.delete(d.ref));
            
            // Filter to only accepted teams for this category
            let teamsForStandings = tData.teams?.filter(t => t.status === RegistrationStatus.ACCEPTED) || [];
            if (autoConfig?.categoryId) {
                 teamsForStandings = teamsForStandings.filter(t => t.categoryId === autoConfig.categoryId);
            }
            
            const initialStandings = calculateStats(teamsForStandings, [], tData.format);
            initialStandings.forEach(team => {
                const sRef = doc(standingsCol, team.id);
                batch.set(sRef, cleanData(team));
            });

            await batch.commit();
            await updateDoc(tRef, { matches: [] }); // Clear array so that subs are used
        }
    } else {
        const t = mockTournaments.find(x => x.id === tId);
        if (t) {
            t.matches = calculateSchedule(t, knockoutConfig, autoConfig);
            notifyMock();
        }
    }
};


export const appendNewMexicanoRound = async (tId: string) => {
    if (!db) return;
    const tRef = doc(db, "tournaments", tId);
    const snap = await getDoc(tRef);
    if (!snap.exists()) return;
    
    const tData = snap.data() as Tournament;
    if (tData.format !== TournamentFormat.MEXICANO) return;

    const matchesCol = collection(db, "tournaments", tId, "matches");
    const existing = await getDocs(matchesCol);
    const currentMatches = existing.docs.map(d => d.data() as Match);

    const maxRound = currentMatches.reduce((max, m) => Math.max(max, m.round || 1), 0);
    const nextRound = maxRound + 1;

    let teams = tData.teams?.filter(t => t.status === RegistrationStatus.ACCEPTED) || [];
    if (teams.length < 4) return;

    let players = teams.map(t => ({ id: t.id, name: t.name, points: t.points || 0, gwp: t.gwp || 0 }));
    players.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        return b.gwp - a.gwp;
    });

    while (players.length % 4 !== 0) {
        players.push({ id: `BYE_${players.length}`, name: 'BYE', points: -999, gwp: 0 });
    }

    const genIdStr = () => Math.random().toString(36).substr(2, 9);
    const batch = writeBatch(db);
    let matchCounter = 1;

    for (let i = 0; i < players.length; i += 4) {
        const p1 = players[i];
        const p2 = players[i + 1];
        const p3 = players[i + 2];
        const p4 = players[i + 3];

        const matchId = `m_mexicano_r${nextRound}_${genIdStr()}`;
        const newMatch: Match = {
            id: matchId,
            tournamentId: tId,
            team1Id: `mexicano_temp_team_r${nextRound}_${matchCounter}_1`,
            team2Id: `mexicano_temp_team_r${nextRound}_${matchCounter}_2`,
            team1PlayerIds: [p1.id, p3.id].filter(id => !id.startsWith('BYE')),
            team2PlayerIds: [p2.id, p4.id].filter(id => !id.startsWith('BYE')),
            team1Name: [p1, p3].map(p => p.name).filter(n => n !== 'BYE').join(' & '),
            team2Name: [p2, p4].map(p => p.name).filter(n => n !== 'BYE').join(' & '),
            status: MatchStatus.SCHEDULED,
            score: {
                p1Points: '0', p2Points: '0', p1Games: 0, p2Games: 0,
                p1Sets: 0, p2Sets: 0, p1SetScores: [], p2SetScores: [],
                currentSet: 1, isTiebreak: false, history: []
            },
            court: 'TBD',
            scheduledTime: new Date().toISOString(),
            round: nextRound,
            roundName: `Round ${nextRound}`,
            stage: 'GROUP' // Treated as group stage points
        };

        const mRef = doc(matchesCol, matchId);
        const globalMatchRef = doc(db, "matches", matchId);
        batch.set(mRef, cleanData(newMatch));
        batch.set(globalMatchRef, cleanData({ ...newMatch, tournamentId: tId }));
        matchCounter++;
    }

    await batch.commit();
};

export const updateMatchDetails = async (tId: string, mId: string, updates: Partial<Match>) => {
    if (db) {
        // Update specific match doc in subcollection
        const mRef = doc(db, "tournaments", tId, "matches", mId);
        const globalMatchRef = doc(db, "matches", mId);
        
        try {
           const batch = writeBatch(db);
           batch.update(mRef, cleanData(updates));
           batch.update(globalMatchRef, cleanData(updates));
           await batch.commit();
        } catch(e) {
           // Fallback if the global match document doesn't exist for some reason
           await setDoc(mRef, cleanData(updates), { merge: true });
           await setDoc(globalMatchRef, cleanData({ ...updates, tournamentId: tId, id: mId }), { merge: true });
        }
    } else {
        const t = mockTournaments.find(x => x.id === tId);
        if (t) {
            t.matches = t.matches.map(m => m.id === mId ? { ...m, ...updates } : m);
            notifyMock();
        }
    }
};

export const submitScoreChangeRequest = async (tournamentId: string, request: any) => {
  if (!db) return;
  const reqRef = doc(collection(db, 'scoreChangeRequests'));
  await setDoc(reqRef, {
      ...request,
      tournamentId,
      status: 'pending',
      createdAt: new Date().toISOString()
  });
};

export const subscribeToScoreChangeRequests = (venueIdOrTournamentId: string, callback: (data: any[]) => void) => {
  if (!db) return () => {};
  // For now we'll just fetch all or filter by tournamentId since venue connection might need more work,
  // Let's filter by status pending/approved/rejected, and tournamentId
  // Wait, if it's venue dashboard it might need to get tournaments for that venue
  // For simplicity since DB structure is flat:
  const q = query(collection(db, 'scoreChangeRequests'), orderBy('createdAt', 'desc'), limit(50));
  return onSnapshot(q, (snapshot) => {
      const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(results);
  });
};

export const updateMatchScore = async (tId: string, mId: string, newScore: ScoreState, status: MatchStatus, winnerId?: string) => {
    if (db) {
        const mRef = doc(db, "tournaments", tId, "matches", mId);
        const globalMatchRef = doc(db, "matches", mId);
        
        const updatePayload = cleanData({ 
            score: newScore, 
            status, 
            winnerTeamId: winnerId,
            // Trigger a score update event automatically
            activeBroadcastEvent: {
                id: genId(),
                type: 'SCORE_UPDATE',
                timestamp: Date.now(),
                duration: 3000
            }
        });
        
        // 1. Update the match score directly (Fast)
        try {
           const batch = writeBatch(db);
           batch.update(mRef, updatePayload);
           batch.update(globalMatchRef, updatePayload);
           await batch.commit();
        } catch(e) {
           await setDoc(mRef, updatePayload, { merge: true });
           await setDoc(globalMatchRef, { ...updatePayload, tournamentId: tId, id: mId }, { merge: true });
        }

        // 2. If match completed, handle bracket advancement (Slower, can be async)
        if (status === MatchStatus.COMPLETED && winnerId) {
            // We need to fetch all matches to calculate advancement
            // This is heavy, but only happens on match completion
            const matchesSnap = await getDocs(collection(db, "tournaments", tId, "matches"));
            let allMatches = matchesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Match));
            const match = allMatches.find(m => m.id === mId);
            
            if (match) {
                // Guarantee newest score and status are reflected locally for reliable brackets and standings
                match.status = status;
                match.score = newScore;
                match.winnerTeamId = winnerId;

                const updatedMatches = advanceBracket(allMatches, match, winnerId);
                
                // Fetch the tournament to attach names for advanced matches
                const tRef = doc(db, "tournaments", tId);
                const tSnap = await getDoc(tRef);
                const tData = tSnap.exists() ? tSnap.data() as Tournament : null;

                // Save updated matches (only the ones that changed)
                const batch = writeBatch(db);
                updatedMatches.forEach(m => {
                    if (m.id !== mId) { // Skip current match as we already updated it
                        // Attach team names if possible before saving
                        if (tData && tData.teams) {
                            const t1 = tData.teams.find(t => t.id === m.team1Id);
                            const t2 = tData.teams.find(t => t.id === m.team2Id);
                            if (t1) {
                                m.team1Name = t1.name;
                                m.team1PlayerNames = [t1.player1?.name, t1.player2?.name].filter(Boolean).join(' & ');
                            }
                            if (t2) {
                                m.team2Name = t2.name;
                                m.team2PlayerNames = [t2.player1?.name, t2.player2?.name].filter(Boolean).join(' & ');
                            }
                        }
                        const mRef = doc(db, "tournaments", tId, "matches", m.id);
                        batch.set(mRef, cleanData(m), { merge: true });
                    }
                });
                await batch.commit();
            }
            
            // Update stats on teams (Main Doc)
            const tRefStats = doc(db, "tournaments", tId);
            const tSnapStats = await getDoc(tRefStats);
            if (tSnapStats.exists()) {
                const t = tSnapStats.data() as Tournament;
                const updatedTeams = calculateStats(t.teams, allMatches, t.format);
                
                const statsBatch = writeBatch(db);
                statsBatch.update(tRefStats, cleanData({ teams: updatedTeams }));
                
                const standingsCol = collection(db, "tournaments", tId, "standings");
                updatedTeams.forEach(tea => {
                     const sRef = doc(standingsCol, tea.id);
                     if (tea.status === RegistrationStatus.ACCEPTED) {
                         statsBatch.set(sRef, cleanData(tea));
                     } else {
                         statsBatch.delete(sRef);
                     }
                });
                
                await statsBatch.commit();
            }
        }
    } else {
        const t = mockTournaments.find(x => x.id === tId);
        if (t) {
            let updatedMatches = t.matches.map(m => {
                if (m.id === mId) return { ...m, score: newScore, status, winnerTeamId: winnerId };
                return m;
            });
            const match = updatedMatches.find(m => m.id === mId);
            if (status === MatchStatus.COMPLETED && winnerId && match) {
                updatedMatches = advanceBracket(updatedMatches, match, winnerId);
            }
            const updatedTeams = calculateStats(t.teams, updatedMatches, t.format);
            t.matches = updatedMatches;
            t.teams = updatedTeams;
            notifyMock();
        }
    }
};

export const triggerBroadcastEvent = async (tId: string, mId: string, event: any) => {
    if (db) {
        const mRef = doc(db, "tournaments", tId, "matches", mId);
        await updateDoc(mRef, {
            activeBroadcastEvent: cleanData(event)
        });
    } else {
        // Mock implementation
        const t = mockTournaments.find(x => x.id === tId);
        if (t) {
            const m = t.matches.find(m => m.id === mId);
            if (m) {
                m.activeBroadcastEvent = event;
                notifyMock();
            }
        }
    }
};



export const addRefereeTag = async (tId: string, mId: string, tag: string) => {
    if (db) {
        const mRef = doc(db, "tournaments", tId, "matches", mId);
        const snap = await getDoc(mRef);
        if (snap.exists()) {
            const mData = snap.data() as Match;
            await updateDoc(mRef, cleanData({ refereeNotes: [...(mData.refereeNotes || []), tag] }));
        }
    } else {
        const t = mockTournaments.find(x => x.id === tId);
        if (t) {
            t.matches = t.matches.map(m => m.id === mId ? { ...m, refereeNotes: [...(m.refereeNotes || []), tag] } : m);
            notifyMock();
        }
    }
};

export const addKnockoutMatch = async (tId: string, categoryId?: string | null, name?: string, team1Id?: string, team2Id?: string, scheduledTime?: string, court?: string) => {
    const genMatchId = () => Math.random().toString(36).substr(2, 9);
    
    // Helper to get current matches
    const getCurrentMatches = async () => {
        if (db) {
            const matchesCol = collection(db, "tournaments", tId, "matches");
            const snap = await getDocs(matchesCol);
            return snap.docs.map(d => ({ id: d.id, ...d.data() } as Match));
        } else {
            const t = mockTournaments.find(x => x.id === tId);
            return t ? t.matches : [];
        }
    };

    const matches = await getCurrentMatches();
    
    // Auto-resolve round: Find max round or default to 1
    const maxRound = matches.reduce((max, m) => Math.max(max, m.round || 0), 0) || 1;
    
    // Auto-resolve bracket slot: Just append for now
    // In a real binary tree, we'd calculate the next open node.
    let t1Name = '', t2Name = '', t1P = '', t2P = '';
    if (db) {
        const tRef = doc(db, "tournaments", tId);
        const snap = await getDoc(tRef);
        if (snap.exists()) {
            const tData = snap.data() as Tournament;
            const t1 = tData.teams?.find(t => t.id === team1Id);
            const t2 = tData.teams?.find(t => t.id === team2Id);
            if (t1) { t1Name = t1.name; t1P = [t1.player1?.name, t1.player2?.name].filter(Boolean).join(' & '); }
            if (t2) { t2Name = t2.name; t2P = [t2.player1?.name, t2.player2?.name].filter(Boolean).join(' & '); }
        }
    }
    
    const newMatch: Match = {
        id: genMatchId(),
        tournamentId: tId,
        categoryId: categoryId || undefined,
        team1Id: team1Id || '',
        team2Id: team2Id || '',
        team1Name: t1Name || (team1Id === 'BYE' ? 'BYE' : ''),
        team2Name: t2Name || (team2Id === 'BYE' ? 'BYE' : ''),
        team1PlayerNames: t1P,
        team2PlayerNames: t2P,
        stage: 'BRACKET',
        round: maxRound,
        roundName: name || `Match ${matches.length + 1}`,
        court: court || 'TBD', // Auto-resolved to placeholder
        scheduledTime: scheduledTime || new Date(Date.now() + 3600000).toISOString(), // +1 hour default
        status: MatchStatus.SCHEDULED,
        score: deepClone(initialScore)
    };

    if (db) {
        const mRef = doc(db, "tournaments", tId, "matches", newMatch.id);
        const globalMatchRef = doc(db, "matches", newMatch.id);
        const batch = writeBatch(db);
        batch.set(mRef, cleanData(newMatch));
        batch.set(globalMatchRef, cleanData({ ...newMatch, tournamentId: tId }));
        await batch.commit();
    } else {
        const t = mockTournaments.find(x => x.id === tId);
        if (t) {
            t.matches.push(newMatch);
            notifyMock();
        }
    }

    return newMatch;
};

export const deleteMatch = async (tId: string, mId: string) => {
    if (db) {
        const batch = writeBatch(db);
        const mRef = doc(db, "tournaments", tId, "matches", mId);
        const globalMatchRef = doc(db, "matches", mId);
        batch.delete(mRef);
        batch.delete(globalMatchRef);
        await batch.commit();
    } else {
        const t = mockTournaments.find(x => x.id === tId);
        if (t && t.matches) {
            t.matches = t.matches.filter(m => m.id !== mId);
            notifyMock();
        }
    }
};

export const advanceBracket = (allMatches: Match[], completedMatch: Match, winnerId: string): Match[] => {
    return allMatches.map(m => {
        if (completedMatch.nextMatchId && m.id === completedMatch.nextMatchId) {
             if (m.team1Dependency?.sourceId === completedMatch.id) return { ...m, team1Id: winnerId };
             if (m.team2Dependency?.sourceId === completedMatch.id) return { ...m, team2Id: winnerId };
             if (!m.team1Id) return { ...m, team1Id: winnerId };
             if (!m.team2Id) return { ...m, team2Id: winnerId };
        }
        if (m.team1Dependency?.sourceId === completedMatch.id) return { ...m, team1Id: winnerId };
        if (m.team2Dependency?.sourceId === completedMatch.id) return { ...m, team2Id: winnerId };
        return m;
    });
};

// ==================================================================
// QUICK PLAY (COURT-SIDE)
// ==================================================================

export const createQuickSession = async (session: Omit<QuickSession, 'id' | 'createdAt'>): Promise<string> => {
    const newSession: QuickSession = {
        ...session,
        id: 'qs_' + Math.random().toString(36).substr(2, 9),
        createdAt: new Date().toISOString()
    };

    if (db) {
        try {
            const ref = doc(db, 'quickSessions', newSession.id);
            await setDoc(ref, cleanData(newSession));
        } catch (e) {
            handleFirestoreError(e, OperationType.CREATE, 'quickSessions');
        }
    }
    return newSession.id;
};

export const subscribeToQuickSession = (sessionId: string, callback: (session: QuickSession | null) => void) => {
    if (db) {
        const ref = doc(db, 'quickSessions', sessionId);
        return onSnapshot(ref, (docSnap) => {
            if (docSnap.exists()) {
                callback(docSnap.data() as QuickSession);
            } else {
                callback(null);
            }
        }, (error) => {
            handleFirestoreError(error, OperationType.GET, `quickSessions/${sessionId}`);
        });
    } else {
        // Mock fallback
        callback(null);
        return () => {};
    }
};

export const updateQuickSession = async (sessionId: string, updates: Partial<QuickSession>) => {
    if (db) {
        try {
            const ref = doc(db, 'quickSessions', sessionId);
            await updateDoc(ref, cleanData(updates));
        } catch (e) {
            handleFirestoreError(e, OperationType.UPDATE, `quickSessions/${sessionId}`);
        }
    }
};

// ==================================================================
// NEW MATCH UP V2 FUNCTIONS
// ==================================================================

export const signUpUser = async (fullName: string, phone: string, promoCode?: string) => {
  if (!db || !auth) throw new Error("Firebase not initialized");
  
  // Sign in anonymously
  const userCredential = await signInAnonymously(auth);
  const user = userCredential.user;
  
  let pointsEarned = 0;
  let referredBy = null;
  
  if (promoCode) {
    const promoRef = doc(db, 'promoCodes', promoCode);
    const promoSnap = await getDoc(promoRef);
    if (promoSnap.exists()) {
      const promoData = promoSnap.data();
      const uniqueSignUps = promoData.uniqueSignUps || [];
      if (!uniqueSignUps.includes(user.uid)) {
        referredBy = promoCode;
        await updateDoc(promoRef, {
          uniqueSignUps: arrayUnion(user.uid),
          pointsEarned: increment(100)
        });
      }
    }
  }
  
  const userData = {
    id: user.uid,
    fullName,
    phone,
    role: 'player',
    stats: {
      matchesPlayed: 0,
      wins: 0,
      losses: 0,
      setsWon: 0,
      eloRating: 1000
    },
    firstMiniTournamentUsed: false,
    promoCode: null,
    promoPoints: 0,
    referredBy,
    createdAt: new Date().toISOString()
  };
  
  await setDoc(doc(db, 'players', user.uid), userData);
  await syncSingleStandalonePlayerToGlobal(userData);
  
  // Increment global players
  const globalRef = doc(db, 'globalStats', 'singleton');
  await setDoc(globalRef, { totalPlayers: increment(1) }, { merge: true });
  
  return userData;
};

export const subscribeToGlobalStats = (cb: (stats: any) => void) => {
  if (!db) return () => {};
  return onSnapshot(doc(db, 'globalStats', 'singleton'), (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      cb({
        totalMatches: data.totalMatches || 0,
        totalPlayers: data.totalPlayers || 0,
        totalCourts: data.totalCourts || 0
      });
    } else {
      cb({ totalMatches: 0, totalPlayers: 0, totalCourts: 0 });
    }
  });
};

export const incrementGlobalMatches = async (count: number = 1) => {
  if (!db) return;
  const globalRef = doc(db, 'globalStats', 'singleton');
  await setDoc(globalRef, { totalMatches: increment(count) }, { merge: true });
};

export const updatePlayerStats = async (userId: string, statsUpdate: { matchesPlayed?: number, wins?: number, losses?: number, setsWon?: number, eloRating?: number }) => {
  if (!db) return;
  try {
    const userRef = doc(db, 'players', userId);
    const updates: any = {};
    if (statsUpdate.matchesPlayed) updates['stats.matchesPlayed'] = increment(statsUpdate.matchesPlayed);
    if (statsUpdate.wins) updates['stats.wins'] = increment(statsUpdate.wins);
    if (statsUpdate.losses) updates['stats.losses'] = increment(statsUpdate.losses);
    if (statsUpdate.setsWon) updates['stats.setsWon'] = increment(statsUpdate.setsWon);
    if (statsUpdate.eloRating) updates['stats.eloRating'] = increment(statsUpdate.eloRating);
    
    if (Object.keys(updates).length > 0) {
      await updateDoc(userRef, updates);
    }
  } catch (e) {
    handleFirestoreError(e, OperationType.UPDATE, `players/${userId}`);
  }
};

export const getCourtsByVenueIds = async (venueIds: string[]) => {
  if (!db || venueIds.length === 0) return [];
  // Firestore array-contains-any has a limit of 10, but IN has a limit of 10. Let's chunk if necessary or just do multiple queries.
  // We'll just do separate queries or a chunked IN query
  let allCourts: any[] = [];
  try {
      const courtsRef = collection(db, 'courts');
      for (let i = 0; i < venueIds.length; i += 10) {
          const chunk = venueIds.slice(i, i + 10);
          const q = query(courtsRef, where('venueId', 'in', chunk));
          const snapshot = await getDocs(q);
          const courts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          allCourts = [...allCourts, ...courts];
      }
      return allCourts;
  } catch (err) {
      console.error(err);
      return [];
  }
};

export const getCourtByToken = async (token: string, type: 'player' | 'admin') => {
  if (!db) return null;
  const field = type === 'player' ? 'qrToken' : 'adminQrToken';
  const q = query(collection(db, 'courts'), where(field, '==', token));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() };
};

export const getVenueById = async (venueId: string) => {
  if (!db) return null;
  const snap = await getDoc(doc(db, 'venues', venueId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

export const createQuickplaySessionV2 = async (sessionData: any) => {
  if (!db) return null;
  try {
    const docRef = await addDoc(collection(db, 'quickplaySessions'), {
      ...sessionData,
      createdAt: new Date().toISOString()
    });
    return docRef.id;
  } catch (e) {
    handleFirestoreError(e, OperationType.CREATE, 'quickplaySessions');
    return null;
  }
};

export const subscribeToQuickplaySessionV2 = (sessionId: string, cb: (data: any) => void) => {
  if (!db) return () => {};
  
  let unsub2: any = null;
  
  const unsub1 = onSnapshot(doc(db, 'quickplaySessions', sessionId), (docSnap) => {
    if (docSnap.exists()) {
      cb({ id: docSnap.id, ...docSnap.data() });
    } else {
      // Fallback to old collection
      unsub2 = onSnapshot(doc(db, 'quickSessions', sessionId), (docSnap2) => {
        if (docSnap2.exists()) {
          cb({ id: docSnap2.id, ...docSnap2.data() });
        } else {
          cb(null);
        }
      });
    }
  });

  return () => {
    unsub1();
    if (unsub2) unsub2();
  };
};

export const subscribeToPlayerQuickplaySessions = (userId: string, userEmail: string | undefined, cb: (data: any[]) => void) => {
  if (!db) return () => {};
  
  let sessions1: any[] = [];
  let sessions2: any[] = [];
  
  const updateCb = () => {
    const merged = [...sessions1, ...sessions2].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    cb(merged);
  };

  const q1 = query(collection(db, 'quickplaySessions'), where('playerIds', 'array-contains', userId));
  const unsub1 = onSnapshot(q1, (snap) => {
    sessions1 = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    updateCb();
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, 'quickplaySessions');
  });

  let unsub2 = () => {};
  if (userEmail) {
    const q2 = query(collection(db, 'quickSessions'), where('creatorEmail', '==', userEmail));
    unsub2 = onSnapshot(q2, (snap) => {
      sessions2 = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      updateCb();
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'quickSessions');
    });
  }

  return () => {
    unsub1();
    unsub2();
  };
};

export const updateQuickplaySessionV2 = async (sessionId: string, updates: any) => {
  if (!db) return;
  try {
    const docRef = doc(db, 'quickplaySessions', sessionId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      await updateDoc(docRef, updates);
    } else {
      const oldDocRef = doc(db, 'quickSessions', sessionId);
      await updateDoc(oldDocRef, updates);
    }
  } catch (e) {
    handleFirestoreError(e, OperationType.UPDATE, `quickplaySessions/${sessionId}`);
  }
};

export const subscribeToStandings = (tId: string, categoryId: string | null, cb: (data: Team[]) => void) => {
    if (!db) return () => {};
    let standingsQuery: any = collection(db, "tournaments", tId, "standings");
    if (categoryId) {
         standingsQuery = query(standingsQuery, where("categoryId", "==", categoryId));
    }
    return onSnapshot(standingsQuery, (snap: any) => {
         const data = snap.docs.map((doc: any) => doc.data() as Team);
         cb(data);
    });
};

export const getCourtLeaderboard = async (courtId: string) => {
  if (!db) return [];
  const q = query(collection(db, 'players'), orderBy('stats.eloRating', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const subscribeToVenueQuickplayStats = (venueName: string, cb: (data: any[]) => void) => {
  if (!db || !venueName) return () => {};
  const q1 = query(collection(db, 'quickplaySessions'), where('venue', '==', venueName));
  const unsub1 = onSnapshot(q1, (snap) => {
    const sessions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    // Return sessions
    cb(sessions.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, 'quickplaySessions');
  });
  return unsub1;
};

export const startMatch = async (
    tId: string, 
    mId: string, 
    courtId: string | null, 
    courtName: string | null, 
    refereeId: string | null,
    conflictAcknowledged?: boolean | null
) => {
    if (!db) return;
    const mRef = doc(db, "tournaments", tId, "matches", mId);
    const globalMatchRef = doc(db, "matches", mId);
    const obsIndexRef = doc(db, "obsIndex", mId);

    let scheduledCourtId: string | null = null;
    let scheduledStartTime: string | null = null;
    let existingAuditLogs: any[] = [];

    try {
        const mSnap = await getDoc(mRef);
        if (mSnap.exists()) {
            const mData = mSnap.data() as any;
            scheduledCourtId = mData.scheduledCourtId || mData.courtId || null;
            scheduledStartTime = mData.scheduledStartTime || mData.scheduledTime || null;
            existingAuditLogs = mData.auditLogs || [];
        }
    } catch (e) {
        console.error("Failed to fetch match for override check", e);
    }

    // Is it an override?
    const isOverride = courtId !== scheduledCourtId;
    const actualCourtId = isOverride ? courtId : null;
    const courtOverrideBy = isOverride ? (refereeId || 'Referee') : null;
    const courtOverrideAt = isOverride ? new Date().toISOString() : null;

    const auditLogs = [...existingAuditLogs];
    if (isOverride) {
        const logEntry = {
            type: 'court_override',
            oldValue: scheduledCourtId || 'TBD',
            newValue: courtId || 'TBD',
            actor: refereeId || 'Referee',
            timestamp: new Date().toISOString(),
            conflictAcknowledged: !!conflictAcknowledged
        };
        auditLogs.push(logEntry);
    }

    // As per specs
    const obsUrl = `https://matchup.com.pk/#obs/${mId}`;
    const updatePayload: any = {
        courtId: actualCourtId ?? scheduledCourtId ?? courtId,
        courtName: courtName || 'TBD',
        court: courtName || 'TBD', // keep legacy field working
        scheduledCourtId: scheduledCourtId || courtId || 'TBD',
        scheduledStartTime: scheduledStartTime || new Date().toISOString(),
        actualCourtId,
        courtOverrideBy,
        courtOverrideAt,
        conflictAcknowledged: conflictAcknowledged || null,
        auditLogs,
        status: MatchStatus.IN_PROGRESS,
        refereeId,
        startedAt: new Date().toISOString(),
        obsEnabled: true,
        obsUrl
    };

    try {
        const batch = writeBatch(db);
        batch.update(mRef, updatePayload);
        batch.set(globalMatchRef, { ...updatePayload, tournamentId: tId, id: mId }, { merge: true });
        batch.set(obsIndexRef, { tournamentId: tId, matchId: mId });
        await batch.commit();

        // Also save to audit logs subcollection if possible
        if (isOverride) {
            const auditCol = collection(db, "tournaments", tId, "matches", mId, "auditLogs");
            const auditDoc = doc(auditCol);
            await setDoc(auditDoc, {
                type: 'court_override',
                oldValue: scheduledCourtId || 'TBD',
                newValue: courtId || 'TBD',
                actor: refereeId || 'Referee',
                timestamp: new Date().toISOString(),
                conflictAcknowledged: !!conflictAcknowledged
            });
        }
    } catch(e) {
        console.error("Batch update failed in startMatch", e);
        await updateDoc(mRef, updatePayload);
        await setDoc(globalMatchRef, { ...updatePayload, tournamentId: tId, id: mId }, { merge: true });
        await setDoc(obsIndexRef, { tournamentId: tId, matchId: mId });
    }
};

import { deriveWinner, freshStanding } from '../lib/matchUtils';

export const recalculateMatchResult = async (tournamentId: string, matchId: string, newSets: { team1: number, team2: number }[], adminUid: string, adminName: string) => {
    if (!db) return;

    // Fetch tournament data and ALL matches of the tournament beforehand
    const tRef = doc(db, "tournaments", tournamentId);
    const tournamentSnap = await getDoc(tRef);
    if (!tournamentSnap.exists()) throw new Error("Tournament not found");
    const tournamentData = tournamentSnap.data() as Tournament;

    const matchesCol = collection(db, "tournaments", tournamentId, "matches");
    const matchesSnap = await getDocs(matchesCol);
    const allMatches = matchesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Match));

    await runTransaction(db, async (transaction) => {
        const matchRef = doc(db, "tournaments", tournamentId, "matches", matchId);
        const matchDoc = await transaction.get(matchRef);
        if (!matchDoc.exists()) throw new Error("Match missing");

        const match = matchDoc.data() as Match;
        const newWinner = deriveWinner(newSets);

        let newWinnerId: string | null = null;
        if (newWinner === "team1") newWinnerId = match.team1Id || null;
        else if (newWinner === "team2") newWinnerId = match.team2Id || null;

        // Knockout Advancement handling:
        if (match.stage === "knockout") {
            const oldWinnerId = match.winnerTeamId;
            if (oldWinnerId && oldWinnerId !== newWinnerId) {
                // Find downstream match using pre-fetched allMatches
                const nextMatch = allMatches.find(m => {
                    return m.round === (match.round || 0) + 1 &&
                           (m.team1Id === oldWinnerId || m.team2Id === oldWinnerId || 
                            m.team1Dependency?.sourceId === match.id || 
                            m.team2Dependency?.sourceId === match.id);
                });

                if (nextMatch) {
                    if (nextMatch.status === MatchStatus.COMPLETED || nextMatch.status === MatchStatus.IN_PROGRESS) {
                        throw new Error("DOWNSTREAM_MATCH_ACTIVE:" + nextMatch.id);
                    }
                    
                    const nextRef = doc(db, "tournaments", tournamentId, "matches", nextMatch.id);
                    if (nextMatch.team1Id === oldWinnerId || nextMatch.team1Dependency?.sourceId === match.id) {
                        transaction.update(nextRef, cleanData({ 
                            team1Id: newWinnerId || null, 
                            team1Name: newWinnerId ? (newWinner === "team1" ? match.team1Name : match.team2Name) : "TBD" 
                        }));
                        nextMatch.team1Id = newWinnerId || null;
                        nextMatch.team1Name = newWinnerId ? (newWinner === "team1" ? match.team1Name : match.team2Name) : "TBD";
                    } else if (nextMatch.team2Id === oldWinnerId || nextMatch.team2Dependency?.sourceId === match.id) {
                        transaction.update(nextRef, cleanData({ 
                            team2Id: newWinnerId || null, 
                            team2Name: newWinnerId ? (newWinner === "team1" ? match.team1Name : match.team2Name) : "TBD" 
                        }));
                        nextMatch.team2Id = newWinnerId || null;
                        nextMatch.team2Name = newWinnerId ? (newWinner === "team1" ? match.team1Name : match.team2Name) : "TBD";
                    }
                }
            }
        }

        // Update current match score details
        const newScoreObj: ScoreState = {
            p1Points: match.score?.p1Points ?? "0",
            p2Points: match.score?.p2Points ?? "0",
            p1Games: match.score?.p1Games ?? 0,
            p2Games: match.score?.p2Games ?? 0,
            p1Sets: newSets.filter(s => s.team1 > s.team2).length,
            p2Sets: newSets.filter(s => s.team2 > s.team1).length,
            currentSet: match.score?.currentSet ?? 1,
            isTiebreak: match.score?.isTiebreak ?? false,
            history: match.score?.history ?? [],
            p1SetScores: newSets.map(s => s.team1),
            p2SetScores: newSets.map(s => s.team2),
            _isSetCompleted: true
        };

        const previousSetsMap = match.score?.p1SetScores?.map((_,i) => ({team1: match.score?.p1SetScores![i], team2: match.score?.p2SetScores![i]})) || [];

        transaction.update(matchRef, cleanData({
            score: newScoreObj,
            winner: newWinner || null,
            winnerTeamId: newWinnerId || null,
            status: "COMPLETED",
            lastEditedAt: serverTimestamp(),
            lastEditedBy: adminUid,
            editHistory: arrayUnion({
                editedAt: new Date().toISOString(),
                editedBy: adminUid,
                editedByName: adminName,
                previousSets: previousSetsMap,
                previousWinner: match.winnerTeamId || null,
                newSets: newSets,
                newWinner: newWinner || null
            })
        }));

        const globalMatchRef = doc(db, "matches", matchId);
        transaction.set(globalMatchRef, cleanData({
            score: newScoreObj,
            winner: newWinner || null,
            winnerTeamId: newWinnerId || null,
            status: "COMPLETED",
        }), { merge: true });

        // Replace modified match in allMatches array
        const updatedMatches = allMatches.map(m => {
            if (m.id === matchId) {
                return {
                    ...m,
                    score: newScoreObj,
                    status: MatchStatus.COMPLETED,
                    winnerTeamId: newWinnerId
                };
            }
            return m;
        });

        // Recalculate team stats across the entire tournament using existing matches + newly edited match
        const updatedTeams = calculateStats(tournamentData.teams, updatedMatches, tournamentData.format);

        const tUpdates: any = { teams: updatedTeams };
        if (tournamentData.matches && tournamentData.matches.length > 0) {
            tUpdates.matches = tournamentData.matches.map(m => {
                if (m.id === matchId) {
                    return {
                        ...m,
                        score: newScoreObj,
                        status: "COMPLETED",
                        winnerTeamId: newWinnerId
                    };
                }
                return m;
            });
        }

        // Update the teams list (and matches if legacy) on the main tournament document via the transaction
        transaction.update(tRef, cleanData(tUpdates));

        // Update individual team documents in the standings subcollection
        const standingsCol = collection(db, "tournaments", tournamentId, "standings");
        updatedTeams.forEach(tea => {
            const sRef = doc(standingsCol, tea.id);
            if (tea.status === RegistrationStatus.ACCEPTED) {
                transaction.set(sRef, cleanData(tea));
            } else {
                transaction.delete(sRef);
            }
        });
    });
};

export const replaceTeamInTournament = async (tournamentId: string, outgoingTeamId: string, incomingData: any) => {
    if (!db) return;
    try {
        const tournamentRef = doc(db, 'tournaments', tournamentId);
        
        let resolvedNewTeamId = '';
        
        await runTransaction(db, async (t) => {
            const tourneySnap = await t.get(tournamentRef);
            if (!tourneySnap.exists()) throw new Error("Tournament not found");
            const data = tourneySnap.data() as Tournament;
            
            const teams = Array.isArray(data.teams) ? [...data.teams] : [];
            const outgoingIdx = teams.findIndex(team => team.id === outgoingTeamId);
            if (outgoingIdx === -1) throw new Error("Outgoing team not found in tournament");
            
            const outgoingTeam = { ...teams[outgoingIdx] };
            
            // Generate new ID if not selecting existing
            let newTeamId = incomingData.teamId || null;
            if (!newTeamId) {
                newTeamId = genId(); // Local fallback if no global ID generator is available
            }
            resolvedNewTeamId = newTeamId;
            
            // Mark old team as replaced
            teams[outgoingIdx].status = 'replaced' as any;
            
            // Create new team based on existing assignments
            const newTeamObj: Team = {
                id: newTeamId,
                name: incomingData.teamName,
                player1: { name: incomingData.player1Name, phone: '', email: '', verified: false },
                ...(incomingData.player2Name ? { player2: { name: incomingData.player2Name, phone: '', email: '', verified: false } } : { player2: null as any }),
                status: RegistrationStatus.ACCEPTED,
                registeredAt: new Date().toISOString(),
                categoryId: outgoingTeam.categoryId,
                groupId: outgoingTeam.groupId
            };
            
            // Avoid duplicates if choosing an existing waitlist team
            if (!incomingData.teamId) {
                teams.push(newTeamObj);
            } else {
                const existingIdx = teams.findIndex(t => t.id === incomingData.teamId);
                if (existingIdx !== -1) {
                    teams[existingIdx].status = RegistrationStatus.ACCEPTED;
                    teams[existingIdx].categoryId = outgoingTeam.categoryId;
                    teams[existingIdx].groupId = outgoingTeam.groupId;
                }
            }
            
            t.update(tournamentRef, { teams });
            
            // Hard-delete outgoing team from standings subcollection
            const subStandingsRef = doc(db, "tournaments", tournamentId, "standings", outgoingTeamId);
            t.delete(subStandingsRef);
            
            // Update Standings: Hard-delete outgoing team
            let standingsRef;
            if (outgoingTeam.categoryId) {
                standingsRef = doc(db, 'tournament_standings', `${tournamentId}_${outgoingTeam.categoryId}`);
            } else {
                standingsRef = doc(db, 'tournament_standings', tournamentId);
            }
            const standingsSnap = await t.get(standingsRef);
            if (standingsSnap.exists()) {
                const stData = standingsSnap.data() as { standings: any[] };
                let currentStandings = Array.isArray(stData.standings) ? [...stData.standings] : [];
                currentStandings = currentStandings.filter(st => st.teamId !== outgoingTeamId);
                t.update(standingsRef, { standings: currentStandings });
            }
        });

        // Batch update matches outside transaction
        const matchQuery = collection(db, 'tournaments', tournamentId, 'matches');
        const matchSnaps = await getDocs(matchQuery);
        
        const batch = writeBatch(db);
        let batchCount = 0;
        
        matchSnaps.docs.forEach(docSnap => {
            const m = docSnap.data() as Match;
            let needsUpdate = false;
            let updatePayload: any = {};
            
            if (m.team1Id === outgoingTeamId) {
                updatePayload.team1Id = resolvedNewTeamId;
                needsUpdate = true;
            }
            if (m.team2Id === outgoingTeamId) {
                updatePayload.team2Id = resolvedNewTeamId;
                needsUpdate = true;
            }
            
            if (needsUpdate) {
                 if (String(m.status) === 'COMPLETED' || m.status === MatchStatus.COMPLETED) {
                     updatePayload.replacementNote = `Score originally achieved by [${m.team1Id === outgoingTeamId ? m.team1Name || 'Old Team 1' : m.team2Name || 'Old Team 2'}]`;
                 }
                 
                 // Also update name cache if it exists on Match
                 if (m.team1Id === outgoingTeamId) updatePayload.team1Name = incomingData.teamName;
                 if (m.team2Id === outgoingTeamId) updatePayload.team2Name = incomingData.teamName;

                 batch.update(docSnap.ref, updatePayload);
                 
                 // Also update global match if available
                 const globalMatchRef = doc(db, 'matches', docSnap.id);
                 batch.update(globalMatchRef, updatePayload);
                 
                 batchCount += 2;
            }
        });
        
        if (batchCount > 0) {
            await batch.commit();
        }

        await syncTournamentPlayersAndTeams(tournamentId);

    } catch (e: any) {
        handleFirestoreError(e, OperationType.UPDATE, `replaceTeamInTournament/${tournamentId}`);
    }
};

export const editTeamInTournament = async (
    tournamentId: string, 
    teamId: string, 
    name: string, 
    player1Name: string, 
    player2Name?: string
) => {
    if (db) {
        try {
            const tournamentRef = doc(db, 'tournaments', tournamentId);
            
            await runTransaction(db, async (t) => {
                const tourneySnap = await t.get(tournamentRef);
                if (!tourneySnap.exists()) throw new Error("Tournament not found");
                const data = tourneySnap.data() as Tournament;
                
                const teams = Array.isArray(data.teams) ? [...data.teams] : [];
                const teamIdx = teams.findIndex(team => team.id === teamId);
                if (teamIdx === -1) throw new Error("Team not found in tournament");
                
                const existingTeam = { ...teams[teamIdx] };
                
                // Read all other documents BEFORE executing any writes (t.update or t.set)
                const subStandingsRef = doc(db, "tournaments", tournamentId, "standings", teamId);
                const subSnap = await t.get(subStandingsRef);
                
                let standingsRef;
                if (existingTeam.categoryId) {
                    standingsRef = doc(db, 'tournament_standings', `${tournamentId}_${existingTeam.categoryId}`);
                } else {
                    standingsRef = doc(db, 'tournament_standings', tournamentId);
                }
                const standingsSnap = await t.get(standingsRef);
                
                // Perform all updates / writes now
                teams[teamIdx] = {
                    ...existingTeam,
                    name: name,
                    player1: { ...(existingTeam.player1 || { phone: '', email: '', verified: false }), name: player1Name },
                    player2: player2Name ? { ...(existingTeam.player2 || { phone: '', email: '', verified: false }), name: player2Name } : null as any
                };
                
                t.update(tournamentRef, { teams });
                
                if (subSnap.exists()) {
                    t.update(subStandingsRef, cleanData({
                        name: name,
                        player1: { ...(existingTeam.player1 || { phone: '', email: '', verified: false }), name: player1Name },
                        player2: player2Name ? { ...(existingTeam.player2 || { phone: '', email: '', verified: false }), name: player2Name } : null
                    }));
                }
                
                if (standingsSnap.exists()) {
                    const stData = standingsSnap.data() as { standings: any[] };
                    const currentStandings = Array.isArray(stData.standings) ? [...stData.standings] : [];
                    const stIdx = currentStandings.findIndex(st => st.id === teamId || st.teamId === teamId);
                    if (stIdx !== -1) {
                        currentStandings[stIdx] = {
                            ...currentStandings[stIdx],
                            name: name,
                            player1: { ...(existingTeam.player1 || { phone: '', email: '', verified: false }), name: player1Name },
                            player2: player2Name ? { ...(existingTeam.player2 || { phone: '', email: '', verified: false }), name: player2Name } : null
                        };
                        t.update(standingsRef, { standings: currentStandings });
                    }
                }
            });

            // Update matches using batch
            const matchQuery = collection(db, 'tournaments', tournamentId, 'matches');
            const matchSnaps = await getDocs(matchQuery);
            
            const batch = writeBatch(db);
            let batchCount = 0;
            const pNames = [player1Name, player2Name].filter(Boolean).join(' & ');
            
            matchSnaps.docs.forEach(docSnap => {
                const m = docSnap.data() as Match;
                let needsUpdate = false;
                let updatePayload: any = {};
                
                if (m.team1Id === teamId) {
                    updatePayload.team1Name = name;
                    updatePayload.team1PlayerNames = pNames;
                    needsUpdate = true;
                }
                if (m.team2Id === teamId) {
                    updatePayload.team2Name = name;
                    updatePayload.team2PlayerNames = pNames;
                    needsUpdate = true;
                }
                
                if (needsUpdate) {
                     batch.update(docSnap.ref, updatePayload);
                     
                     // Also update global match if available
                     const globalMatchRef = doc(db, 'matches', docSnap.id);
                     batch.update(globalMatchRef, updatePayload);
                     
                     batchCount += 2;
                }
            });
            
            if (batchCount > 0) {
                await batch.commit();
            }
            await syncTournamentPlayersAndTeams(tournamentId);
        } catch (e: any) {
            handleFirestoreError(e, OperationType.UPDATE, `editTeamInTournament/${tournamentId}/${teamId}`);
            throw e;
        }
    } else {
        const t = mockTournaments.find(x => x.id === tournamentId);
        if (t && t.teams) {
            const teamIdx = t.teams.findIndex(x => x.id === teamId);
            if (teamIdx !== -1) {
                const existing = t.teams[teamIdx];
                const updatedTeam = {
                    ...existing,
                    name: name,
                    player1: { ...(existing.player1 || {}), name: player1Name },
                    player2: player2Name ? { ...(existing.player2 || {}), name: player2Name } : null
                };
                t.teams[teamIdx] = updatedTeam as any;
                
                // Also update cached teams in matches locally
                if (t.matches) {
                    const pNames = [player1Name, player2Name].filter(Boolean).join(' & ');
                    t.matches.forEach(m => {
                        if (m.team1Id === teamId) {
                            m.team1Name = name;
                            m.team1PlayerNames = pNames;
                        }
                        if (m.team2Id === teamId) {
                            m.team2Name = name;
                            m.team2PlayerNames = pNames;
                        }
                    });
                }
                notifyMock();
                syncTournamentPlayersAndTeams(tournamentId);
            }
        }
    }
};

export const deleteKnockoutMatchCascade = async (tournamentId: string, matchId: string) => {
    if (!db) return;

    await runTransaction(db, async (transaction) => {
        const matchRef = doc(db, "tournaments", tournamentId, "matches", matchId);
        const matchDoc = await transaction.get(matchRef);
        if (!matchDoc.exists()) throw new Error("Match missing");

        const match = matchDoc.data() as Match;
        
        const stageUpper = match.stage?.toUpperCase();
        const isKnockout = stageUpper === "KNOCKOUT" || 
                          stageUpper === "PLAYOFF" ||
                          stageUpper === "BRACKET" ||
                          match.stage === "knockout" || 
                          match.stage === "brackets" ||
                          match.roundName?.toLowerCase().includes("final") || 
                          match.roundName?.toLowerCase().includes("semi") || 
                          match.roundName?.toLowerCase().includes("quarter") ||
                          match.roundName?.toLowerCase().includes("playoff") ||
                          match.roundName?.toLowerCase().includes("knockout") ||
                          match.roundName?.toLowerCase().includes("bracket") ||
                          match.roundName?.toLowerCase().includes("round of");

        if (!isKnockout) {
            throw new Error("Not a knockout match. Please delete normally.");
        }

        const oldWinnerId = match.winnerTeamId;

        const matchesCol = collection(db, "tournaments", tournamentId, "matches");
        const allMatchesQuery = query(matchesCol);
        const allDocsSnap = await getDocs(allMatchesQuery); // Read
        const nextMatchDoc = allDocsSnap.docs.find(d => {
            const data = d.data();
            return data.round === (match.round || 0) + 1 &&
                   (data.team1Id === oldWinnerId || data.team2Id === oldWinnerId || 
                    (data.dependencyData && data.dependencyData.matchAId === match.id) || 
                    (data.dependencyData && data.dependencyData.matchBId === match.id));
        });

        if (nextMatchDoc && oldWinnerId) {
            const nextData = nextMatchDoc.data();
            if (nextData.status === "live" || nextData.status === "completed" || nextData.status === "in_progress") {
                throw new Error("DOWNSTREAM_MATCH_ACTIVE:" + nextMatchDoc.id);
            }
            
            const nextRef = doc(db, "tournaments", tournamentId, "matches", nextMatchDoc.id);
            if (nextData.team1Id === oldWinnerId || (nextData.dependencyData && nextData.dependencyData.matchAId === match.id)) {
                transaction.update(nextRef, { team1Id: null, team1Name: "TBD", status: MatchStatus.SCHEDULED });
            } else if (nextData.team2Id === oldWinnerId || (nextData.dependencyData && nextData.dependencyData.matchBId === match.id)) {
                transaction.update(nextRef, { team2Id: null, team2Name: "TBD", status: MatchStatus.SCHEDULED });
            }
        }

        transaction.delete(matchRef);
        
        const globalMatchRef = doc(db, "matches", matchId);
        transaction.delete(globalMatchRef);
    });
};

export const getAllRegisteredPlayers = async () => {
    if (!db) {
        try {
            return JSON.parse(localStorage.getItem('matchup_players') || '[]');
        } catch {
            return [];
        }
    }
    try {
        const q = query(collection(db, 'players'));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
        console.error("Error fetching all registered players:", e);
        return [];
    }
};

export const mergePlayerProfiles = async (
    unauthPlayerDetails: { name: string; email: string; phone: string; cnic?: string },
    authPlayer: any
) => {
    if (db) {
        try {
            const toursSnap = await getDocs(collection(db, "tournaments"));
            for (const tDoc of toursSnap.docs) {
                const tData = tDoc.data() as Tournament;
                let tournamentChanged = false;
                
                const updatedTeams = (tData.teams || []).map(team => {
                    let teamChanged = false;
                    let p1 = { ...team.player1 };
                    let p2 = team.player2 ? { ...team.player2 } : null;
                    
                    const isMatch = (p: any) => {
                        if (!p || p.verified) return false;
                        const normalizeName = (name: string) => (name || '').toLowerCase().trim().replace(/\s+/g, ' ');
                        const normalizeEmail = (e: string) => (e || '').toLowerCase().trim();
                        const normalizePhone = (ph: string) => (ph || '').replace(/[^0-9]/g, '');
                        const normalizeCnic = (cn: string) => (cn || '').replace(/[^0-9xX]/g, '');
                        
                        const nameMatches = normalizeName(p.name) === normalizeName(authPlayer.fullName || authPlayer.name);
                        const emailMatches = p.email && authPlayer.email && normalizeEmail(p.email) === normalizeEmail(authPlayer.email);
                        const phoneMatches = p.phone && authPlayer.phone && normalizePhone(p.phone) === normalizePhone(authPlayer.phone);
                        const cnicMatches = p.cnic && authPlayer.cnic && normalizeCnic(p.cnic) === normalizeCnic(authPlayer.cnic);
                        
                        return nameMatches && (emailMatches || phoneMatches || cnicMatches);
                    };
                    
                    if (isMatch(p1)) {
                        p1.id = authPlayer.id;
                        p1.verified = true;
                        p1.name = authPlayer.fullName || authPlayer.name || p1.name;
                        p1.email = authPlayer.email || p1.email;
                        p1.phone = authPlayer.phone || p1.phone;
                        if (authPlayer.cnic) p1.cnic = authPlayer.cnic;
                        if (authPlayer.photoUrl) p1.photoUrl = authPlayer.photoUrl;
                        teamChanged = true;
                    }
                    
                    if (p2 && isMatch(p2)) {
                        p2.id = authPlayer.id;
                        p2.verified = true;
                        p2.name = authPlayer.fullName || authPlayer.name || p2.name;
                        p2.email = authPlayer.email || p2.email;
                        p2.phone = authPlayer.phone || p2.phone;
                        if (authPlayer.cnic) p2.cnic = authPlayer.cnic;
                        if (authPlayer.photoUrl) p2.photoUrl = authPlayer.photoUrl;
                        teamChanged = true;
                    }
                    
                    if (teamChanged) {
                        tournamentChanged = true;
                        return { ...team, player1: p1, player2: p2 };
                    }
                    return team;
                });
                
                if (tournamentChanged) {
                    await updateDoc(tDoc.ref, cleanData({ teams: updatedTeams }));
                    await syncTournamentPlayersAndTeams(tDoc.id);
                }
            }
        } catch (e: any) {
            handleFirestoreError(e, OperationType.UPDATE, `mergePlayerProfiles/${authPlayer.id}`);
        }
    } else {
        mockTournaments.forEach(t => {
            let tournamentChanged = false;
            t.teams = (t.teams || []).map((team: any) => {
                let teamChanged = false;
                let p1 = { ...team.player1 };
                let p2 = team.player2 ? { ...team.player2 } : null;
                
                const isMatch = (p: any) => {
                    if (!p || p.verified) return false;
                    const normalizeName = (name: string) => (name || '').toLowerCase().trim().replace(/\s+/g, ' ');
                    const normalizeEmail = (e: string) => (e || '').toLowerCase().trim();
                    const normalizePhone = (ph: string) => (ph || '').replace(/[^0-9]/g, '');
                    const normalizeCnic = (cn: string) => (cn || '').replace(/[^0-9xX]/g, '');
                    
                    const nameMatches = normalizeName(p.name) === normalizeName(authPlayer.fullName || authPlayer.name);
                    const emailMatches = p.email && authPlayer.email && normalizeEmail(p.email) === normalizeEmail(authPlayer.email);
                    const phoneMatches = p.phone && authPlayer.phone && normalizePhone(p.phone) === normalizePhone(authPlayer.phone);
                    const cnicMatches = p.cnic && authPlayer.cnic && normalizeCnic(p.cnic) === normalizeCnic(authPlayer.cnic);
                    
                    return nameMatches && (emailMatches || phoneMatches || cnicMatches);
                };
                
                if (isMatch(p1)) {
                    p1.id = authPlayer.id;
                    p1.verified = true;
                    p1.name = authPlayer.fullName || authPlayer.name || p1.name;
                    p1.email = authPlayer.email || p1.email;
                    p1.phone = authPlayer.phone || p1.phone;
                    if (authPlayer.cnic) p1.cnic = authPlayer.cnic;
                    teamChanged = true;
                }
                
                if (p2 && isMatch(p2)) {
                    p2.id = authPlayer.id;
                    p2.verified = true;
                    p2.name = authPlayer.fullName || authPlayer.name || p2.name;
                    p2.email = authPlayer.email || p2.email;
                    p2.phone = authPlayer.phone || p2.phone;
                    if (authPlayer.cnic) p2.cnic = authPlayer.cnic;
                    teamChanged = true;
                }
                
                if (teamChanged) {
                    tournamentChanged = true;
                    return { ...team, player1: p1, player2: p2 };
                }
                return team;
            });

            if (tournamentChanged) {
                syncTournamentPlayersAndTeams(t.id);
            }
        });
        notifyMock();
    }
};

export const syncTournamentPlayersAndTeams = async (tId: string) => {
    if (db) {
        try {
            const tRef = doc(db, "tournaments", tId);
            const tSnap = await getDoc(tRef);
            if (!tSnap.exists()) return;
            const tData = tSnap.data() as Tournament;
            const tName = tData.name || '';
            const teams = tData.teams || [];

            for (const team of teams) {
                const teamId = team.id;
                const globalTeamId = `${tId}_${teamId}`;
                const teamRef = doc(db, "onboardedTeams", globalTeamId);

                const teamPayload: OnboardedTeam = {
                    id: globalTeamId,
                    teamId: teamId,
                    name: team.name,
                    tournamentId: tId,
                    tournamentName: tName,
                    player1: team.player1 || null as any,
                    player2: team.player2 || null as any,
                    status: team.status || 'PENDING',
                    registeredAt: team.registeredAt || new Date().toISOString(),
                    categoryId: team.categoryId || '',
                    groupId: team.groupId || '',
                    stats: {
                        matchesPlayed: team.matchesPlayed || 0,
                        wins: team.wins || 0,
                        losses: team.losses || 0,
                        points: team.points || 0,
                        setsWon: team.setsWon || 0,
                        setsLost: team.setsLost || 0,
                        gamesWon: team.gamesWon || 0,
                        gamesLost: team.gamesLost || 0,
                        gamesPlayed: team.gamesPlayed || 0
                    },
                    lastUpdated: new Date().toISOString()
                };

                await setDoc(teamRef, cleanData(teamPayload));

                const syncPlayer = async (p: Player) => {
                    if (!p || !p.name) return;
                    
                    const normalizeName = (name: string) => (name || '').toLowerCase().trim().replace(/\s+/g, '_');
                    const normalizeEmail = (e: string) => (e || '').toLowerCase().trim().replace(/[@.]/g, '_');
                    const normalizePhone = (ph: string) => (ph || '').replace(/[^0-9]/g, '');

                    const playerKey = [
                        normalizeName(p.name),
                        normalizeEmail(p.email || ''),
                        normalizePhone(p.phone || '')
                    ].filter(Boolean).join('__');

                    if (!playerKey) return;

                    const playerRef = doc(db, "onboardedPlayers", playerKey);
                    const playerSnap = await getDoc(playerRef);

                    let existingTournaments: any[] = [];
                    if (playerSnap.exists()) {
                        const existingData = playerSnap.data();
                        existingTournaments = existingData.tournaments || [];
                    }

                    const otherTournaments = existingTournaments.filter((x: any) => x.tournamentId !== tId || x.teamId !== teamId);
                    const currentTournamentInfo = {
                        tournamentId: tId,
                        tournamentName: tName,
                        teamId: teamId,
                        teamName: team.name,
                        partnerName: (p === team.player1 ? team.player2?.name : team.player1?.name) || '',
                        registeredAt: team.registeredAt || new Date().toISOString(),
                        status: team.status || 'PENDING'
                    };

                    const updatedTournaments = [...otherTournaments, currentTournamentInfo];

                    const playerPayload: OnboardedPlayer = {
                        id: playerKey,
                        name: p.name,
                        email: p.email || '',
                        phone: p.phone || '',
                        cnic: p.cnic || '',
                        photoUrl: p.photoUrl || '',
                        verified: p.verified || false,
                        tournaments: updatedTournaments,
                        lastUpdated: new Date().toISOString()
                    };

                    await setDoc(playerRef, cleanData(playerPayload));
                };

                if (team.player1) await syncPlayer(team.player1);
                if (team.player2) await syncPlayer(team.player2);
            }
        } catch (e: any) {
            console.error("Failed to sync players and teams to global collections:", e);
        }
    } else {
        try {
            const t = mockTournaments.find(x => x.id === tId);
            if (!t) return;
            const tName = t.name || '';
            const teams = t.teams || [];

            const mockTeams: OnboardedTeam[] = JSON.parse(localStorage.getItem('matchup_onboarded_teams') || '[]');
            const mockPlayers: OnboardedPlayer[] = JSON.parse(localStorage.getItem('matchup_onboarded_players') || '[]');

            for (const team of teams) {
                const teamId = team.id;
                const globalTeamId = `${tId}_${teamId}`;

                const teamPayload: OnboardedTeam = {
                    id: globalTeamId,
                    teamId: teamId,
                    name: team.name,
                    tournamentId: tId,
                    tournamentName: tName,
                    player1: team.player1 || null as any,
                    player2: team.player2 || null as any,
                    status: team.status || 'PENDING',
                    registeredAt: team.registeredAt || new Date().toISOString(),
                    categoryId: team.categoryId || '',
                    groupId: team.groupId || '',
                    stats: {
                        matchesPlayed: team.matchesPlayed || 0,
                        wins: team.wins || 0,
                        losses: team.losses || 0,
                        points: team.points || 0,
                        setsWon: team.setsWon || 0,
                        setsLost: team.setsLost || 0,
                        gamesWon: team.gamesWon || 0,
                        gamesLost: team.gamesLost || 0,
                        gamesPlayed: team.gamesPlayed || 0
                    },
                    lastUpdated: new Date().toISOString()
                };

                const existingTeamIdx = mockTeams.findIndex(mt => mt.id === globalTeamId);
                if (existingTeamIdx !== -1) {
                    mockTeams[existingTeamIdx] = teamPayload;
                } else {
                    mockTeams.push(teamPayload);
                }

                const syncPlayerMock = (p: Player) => {
                    if (!p || !p.name) return;
                    
                    const normalizeName = (name: string) => (name || '').toLowerCase().trim().replace(/\s+/g, '_');
                    const normalizeEmail = (e: string) => (e || '').toLowerCase().trim().replace(/[@.]/g, '_');
                    const normalizePhone = (ph: string) => (ph || '').replace(/[^0-9]/g, '');

                    const playerKey = [
                        normalizeName(p.name),
                        normalizeEmail(p.email || ''),
                        normalizePhone(p.phone || '')
                    ].filter(Boolean).join('__');

                    const existingPlayerIdx = mockPlayers.findIndex(mp => mp.id === playerKey);
                    let existingTournaments: any[] = [];
                    let playerPayload: OnboardedPlayer;

                    if (existingPlayerIdx !== -1) {
                        existingTournaments = mockPlayers[existingPlayerIdx].tournaments || [];
                        const otherTournaments = existingTournaments.filter((x: any) => x.tournamentId !== tId || x.teamId !== teamId);
                        const currentTournamentInfo = {
                            tournamentId: tId,
                            tournamentName: tName,
                            teamId: teamId,
                            teamName: team.name,
                            partnerName: (p === team.player1 ? team.player2?.name : team.player1?.name) || '',
                            registeredAt: team.registeredAt || new Date().toISOString(),
                            status: team.status || 'PENDING'
                        };
                        playerPayload = {
                            ...mockPlayers[existingPlayerIdx],
                            tournaments: [...otherTournaments, currentTournamentInfo],
                            lastUpdated: new Date().toISOString()
                        };
                        mockPlayers[existingPlayerIdx] = playerPayload;
                    } else {
                        playerPayload = {
                            id: playerKey,
                            name: p.name,
                            email: p.email || '',
                            phone: p.phone || '',
                            cnic: p.cnic || '',
                            photoUrl: p.photoUrl || '',
                            verified: p.verified || false,
                            tournaments: [{
                                tournamentId: tId,
                                tournamentName: tName,
                                teamId: teamId,
                                teamName: team.name,
                                partnerName: (p === team.player1 ? team.player2?.name : team.player1?.name) || '',
                                registeredAt: team.registeredAt || new Date().toISOString(),
                                status: team.status || 'PENDING'
                            }],
                            lastUpdated: new Date().toISOString()
                        };
                        mockPlayers.push(playerPayload);
                    }
                };

                if (team.player1) syncPlayerMock(team.player1);
                if (team.player2) syncPlayerMock(team.player2);
            }

            localStorage.setItem('matchup_onboarded_teams', JSON.stringify(mockTeams));
            localStorage.setItem('matchup_onboarded_players', JSON.stringify(mockPlayers));
        } catch (e) {
            console.error("Failed to sync mock players/teams:", e);
        }
    }
};

export const syncSingleStandalonePlayerToGlobal = async (p: any) => {
    if (db && p && p.name) {
        try {
            const normalizeName = (name: string) => (name || '').toLowerCase().trim().replace(/\s+/g, '_');
            const normalizeEmail = (e: string) => (e || '').toLowerCase().trim().replace(/[@.]/g, '_');
            const normalizePhone = (ph: string) => (ph || '').replace(/[^0-9]/g, '');

            const playerKey = [
                normalizeName(p.name),
                normalizeEmail(p.email || ''),
                normalizePhone(p.phone || '')
            ].filter(Boolean).join('__');

            if (!playerKey) return;

            const playerRef = doc(db, "onboardedPlayers", playerKey);
            
            const playerPayload: Partial<OnboardedPlayer> = {
                id: playerKey,
                name: p.name,
                email: p.email || '',
                phone: p.phone || '',
                cnic: p.cnic || '',
                photoUrl: p.photoUrl || '',
                verified: p.verified || false,
                lastUpdated: new Date().toISOString()
            };

            await setDoc(playerRef, cleanData(playerPayload), { merge: true });
        } catch (e: any) {
            console.error("Failed to sync single player", e);
        }
    }
};

export const syncStandalonePlayersToGlobal = async () => {
    if (db) {
        try {
            const playersSnap = await getDocs(collection(db, "players"));
            let batch = writeBatch(db);
            let batchCount = 0;

            for (const docSnap of playersSnap.docs) {
                const p = docSnap.data() as any;
                if (!p || !p.name) continue;

                const normalizeName = (name: string) => (name || '').toLowerCase().trim().replace(/\s+/g, '_');
                const normalizeEmail = (e: string) => (e || '').toLowerCase().trim().replace(/[@.]/g, '_');
                const normalizePhone = (ph: string) => (ph || '').replace(/[^0-9]/g, '');

                const playerKey = [
                    normalizeName(p.name),
                    normalizeEmail(p.email || ''),
                    normalizePhone(p.phone || '')
                ].filter(Boolean).join('__');

                if (!playerKey) continue;

                const playerRef = doc(db, "onboardedPlayers", playerKey);
                
                const playerPayload: Partial<OnboardedPlayer> = {
                    id: playerKey,
                    name: p.name,
                    email: p.email || '',
                    phone: p.phone || '',
                    cnic: p.cnic || '',
                    photoUrl: p.photoUrl || '',
                    verified: p.verified || false,
                    lastUpdated: new Date().toISOString()
                };

                batch.set(playerRef, cleanData(playerPayload), { merge: true });
                batchCount++;

                if (batchCount === 400) {
                    await batch.commit();
                    batch = writeBatch(db);
                    batchCount = 0;
                }
            }

            if (batchCount > 0) {
                await batch.commit();
            }
            console.log("Successfully synchronized standalone players to global collections.");
        } catch (e: any) {
            console.error("Failed to sync standalone players", e);
        }
    }
};

export const syncAllDataToGlobal = async () => {
    if (db) {
        try {
            console.log("Starting full global sync...");
            await syncStandalonePlayersToGlobal();
            const toursSnap = await getDocs(collection(db, "tournaments"));
            for (const docSnap of toursSnap.docs) {
                await syncTournamentPlayersAndTeams(docSnap.id);
            }
            console.log("Successfully synchronized all data to global collections.");
        } catch (e: any) {
            handleFirestoreError(e, OperationType.LIST, "syncAllDataToGlobal");
        }
    } else {
        mockTournaments.forEach(t => {
            syncTournamentPlayersAndTeams(t.id);
        });
    }
};
