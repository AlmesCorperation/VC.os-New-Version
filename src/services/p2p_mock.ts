// Zero-dependency Local & P2P mock representing the retired Firebase connection
// All publications and logins are persisted locally on the machine via localStorage
// And support WebRTC data channel sync

let peerConnection: RTCPeerConnection | null = null;
let dataChannel: RTCDataChannel | null = null;

const configuration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

export const initP2P = () => {
  peerConnection = new RTCPeerConnection(configuration);
  
  peerConnection.onicecandidate = event => {
    if (event.candidate) {
      console.log('New ICE candidate:', event.candidate);
      // Signaling mechanism would go here
    }
  };

  dataChannel = peerConnection.createDataChannel('vcos-sync');
  dataChannel.onopen = () => console.log('Data channel open');
  dataChannel.onmessage = event => console.log('Message received:', event.data);
  
  return peerConnection;
};

export const db: any = {
  _isMock: true,
  _rtc: { peerConnection, dataChannel }
};

export const auth: any = {
  currentUser: {
    uid: 'local_dev',
    displayName: localStorage.getItem('vcos_username') || 'Local Pioneer',
    email: 'local@vcos.lan',
    isAnonymous: false,
    emailVerified: true,
    providerData: []
  },
  signOut: async () => {
    localStorage.removeItem('vcos_username');
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  }
};

export function onAuthStateChanged(authInstance: any, callback: (user: any) => void) {
  // Trigger callback with our default mock user
  const triggerAuth = () => {
    const username = localStorage.getItem('vcos_username');
    if (username) {
      callback({
        uid: 'local_dev',
        displayName: username,
        email: 'local@vcos.lan',
        isAnonymous: false,
        emailVerified: true,
        providerData: []
      });
    } else {
      callback(null);
    }
  };

  setTimeout(triggerAuth, 10);
  
  // Listen for login/logout events to trigger callback
  if (typeof window !== 'undefined') {
    window.addEventListener('vcos_auth_state_changed', triggerAuth);
  }

  // Return unsubscribe function
  return () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('vcos_auth_state_changed', triggerAuth);
    }
  };
}

// Mock Firestore functions
export function collection(dbInstance: any, path: string) {
  return { path };
}

export function doc(dbInstance: any, path: string, childPath?: string) {
  return { path: childPath ? `${path}/${childPath}` : path, id: childPath || path };
}

export function query(collectionInstance: any, ...args: any[]) {
  return collectionInstance;
}

export function orderBy(field: string, direction?: string) {
  return { field, direction };
}

// Keep snapshot listeners in sync with custom published games
export function onSnapshot(queryInstance: any, onNext: (snapshot: any) => void, onError?: (error: any) => void) {
  const loadLocalGames = () => {
    try {
      const stored = localStorage.getItem('vcos_published_games');
      const localGames = stored ? JSON.parse(stored) : [];
      
      const docs = localGames.map((game: any) => ({
        data: () => game,
        id: game.id
      }));
      
      onNext({ docs });
    } catch (e) {
      if (onError) onError(e);
    }
  };

  // Run initially
  setTimeout(loadLocalGames, 50);

  // Poll or register an event for updates
  const handleUpdate = () => {
    loadLocalGames();
  };
  
  if (typeof window !== 'undefined') {
    window.addEventListener('vcos_game_published', handleUpdate);
  }

  return () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('vcos_game_published', handleUpdate);
    }
  };
}

export function serverTimestamp() {
  return new Date().toISOString();
}

export async function setDoc(docInstance: any, data: any, options?: any) {
  if (docInstance.path.startsWith('games/')) {
    try {
      const stored = localStorage.getItem('vcos_published_games');
      const localGames = stored ? JSON.parse(stored) : [];
      const gameId = docInstance.id;
      
      // Update or insert
      const index = localGames.findIndex((g: any) => g.id === gameId);
      if (index >= 0) {
        localGames[index] = { ...localGames[index], ...data };
      } else {
        localGames.push(data);
      }
      
      localStorage.setItem('vcos_published_games', JSON.stringify(localGames));
      
      // Notify snapshot listeners
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('vcos_game_published'));
      }
      
      // P2P Data Sync
      if (dataChannel && dataChannel.readyState === 'open') {
          dataChannel.send(JSON.stringify({ type: 'UPDATE_GAME', data: data }));
      }
    } catch (e) {
      console.error('Failed to save game to local storage buffer', e);
    }
  }
  return true;
}

export async function getDoc(docInstance: any) {
  return {
    exists: () => false,
    data: () => null
  };
}

export const signInAnon = async () => {
  return { user: auth.currentUser };
};

export const signOut = async () => {
  return auth.signOut();
};

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  console.warn('Silent Firestore Mock Warning:', error, operationType, path);
}
