import React, { useState, useEffect, useMemo } from "react";
import { Plus, Trash2, AlertTriangle, ChevronUp, ChevronDown, MoveDown, User, LogOut, Users, KeyRound } from "lucide-react";

import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  User as FirebaseUser
} from 'firebase/auth';
import {
  collection,
  query,
  onSnapshot,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  Firestore,
  getDoc,
  serverTimestamp
} from "firebase/firestore";

// --- Firebase Configuration ---
import { auth, db, PUBLIC_ORDERS_COLLECTION, INVITES_COLLECTION } from './firebase';

// --- CONSTANTS ---
const DEFAULT_PRINT_TYPES_INITIAL: string[] = [];
const TECH_DIGITAL = "digital";
const TECH_OFFSET = "offset";
const STAGE_ORDER = ["studio", "print", "bookbinding", "completed"];

// --- TYPE DEFINITIONS ---
type Stage = "studio" | "print" | "bookbinding" | "completed";

const STAGE_LABELS: Record<Stage, string> = {
  studio: "Studio",
  print: "Tisk",
  bookbinding: "Knihárna",
  completed: "Hotovo",
};

interface Order {
  id: string;
  orderNumber: string;
  clientName: string;
  deliveryDate: string;
  currentStage: Stage;
  isCompleted: boolean;
  isUrgent: boolean;
  printType: string[];
  notes: string;
  createdAt: any;
}

interface Invite {
  id: string;
  createdAt: any;
}

interface SortState {
  column: string;
  direction: 'asc' | 'desc';
}

// --- HELPER COMPONENTS ---

const CustomConfirm: React.FC<{ message: string; onConfirm: () => void; onCancel: () => void; }> = ({ message, onConfirm, onCancel }) => (
  <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex justify-center items-center z-50 px-4">
    <div className="bg-white p-6 rounded-lg shadow-xl max-w-sm w-full">
      <AlertTriangle className="w-6 h-6 text-red-500 mx-auto mb-4" />
      <p className="text-center text-gray-700 mb-6">{message}</p>
      <div className="flex justify-center space-x-4">
        <button onClick={onCancel} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 font-medium transition text-sm">Zrušit</button>
        <button onClick={onConfirm} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 font-medium transition text-sm">Smazat</button>
      </div>
    </div>
  </div>
);

const SortIndicator: React.FC<{ column: string; label: string; sortState: SortState; handleSort: (column: string) => void; }> = ({ column, label, sortState, handleSort }) => {
  const isCurrent = sortState.column === column;
  const isAsc = sortState.direction === 'asc';
  return (
    <th onClick={() => handleSort(column)} className={`px-3 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider min-w-[${column === 'clientName' ? '280px' : '80px'}] cursor-pointer group hover:bg-gray-100 transition duration-150`}>
      <div className="flex items-center justify-start space-x-1">
        <span className="truncate">{label}</span>
        {isCurrent ? (isAsc ? <ChevronUp className="w-4 h-4 text-blue-500" /> : <ChevronDown className="w-4 h-4 text-blue-500" />) : (<MoveDown className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors" />)}
      </div>
    </th>
  );
};

// --- LOGIN PAGE COMPONENT ---
const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleAuthAction = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (!auth || !db) {
      setError("Firebase není správně nakonfigurován.");
      setIsLoading(false);
      return;
    }

    try {
      if (isRegistering) {
        if (!inviteCode.trim()) {
          throw { code: 'auth/invalid-invite-code', message: 'Kód pozvánky je povinný.' };
        }
        const inviteRef = doc(db, INVITES_COLLECTION, inviteCode.trim());
        const inviteDoc = await getDoc(inviteRef);
        if (!inviteDoc.exists()) {
          throw { code: 'auth/invalid-invite-code', message: 'Tento kód pozvánky neexistuje nebo již byl použit.' };
        }
        await createUserWithEmailAndPassword(auth, email, password);
        await deleteDoc(inviteRef);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      switch (err.code) {
        case 'auth/invalid-email': setError('Neplatný formát e-mailu.'); break;
        case 'auth/user-not-found': setError('Uživatel s tímto e-mailem neexistuje.'); break;
        case 'auth/wrong-password': setError('Nesprávné heslo.'); break;
        case 'auth/email-already-in-use': setError('Tento e-mail je již registrován.'); break;
        case 'auth/weak-password': setError('Heslo musí mít alespoň 6 znaků.'); break;
        case 'auth/invalid-invite-code': setError(err.message); break;
        default: setError('Nastala chyba. Zkuste to prosím znovu.'); console.error(err);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="w-full max-w-sm p-8 space-y-4 bg-white rounded-xl shadow-lg">
        <div className="text-center">
          <p className="text-sm text-gray-600">
            {isRegistering ? 'Vytvořte si nový účet pro přístup' : 'Přihlaste se ke svému účtu'}
          </p>
        </div>
        <form onSubmit={handleAuthAction} className="space-y-4">
          {isRegistering && (
            <div>
              <label htmlFor="inviteCode" className="text-xs font-medium text-gray-700">Kód pozvánky</label>
              <input id="inviteCode" type="text" value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} required className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          )}
          <div>
            <label htmlFor="email" className="text-xs font-medium text-gray-700">E-mail</label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label htmlFor="password" className="text-xs font-medium text-gray-700">Heslo</label>
            <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          {error && <p className="text-xs text-red-600 text-center">{error}</p>}
          <button type="submit" disabled={isLoading} className="w-full px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:bg-gray-400">
            {isLoading ? 'Pracuji...' : (isRegistering ? 'Zaregistrovat se' : 'Přihlásit se')}
          </button>
        </form>
        <p className="text-xs text-center text-gray-600">
          {isRegistering ? 'Už máte účet?' : 'Potřebujete účet?'}
          <button onClick={() => { setIsRegistering(!isRegistering); setError(''); }} className="ml-1 font-medium text-blue-600 hover:underline">
            {isRegistering ? 'Přihlaste se' : 'Zaregistrujte se'}
          </button>
        </p>
      </div>
    </div>
  );
};

// --- USER MANAGEMENT COMPONENT ---
const UserManagementPage: React.FC<{ db: Firestore, onBack: () => void }> = ({ db, onBack }) => {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const invitesQuery = query(collection(db, INVITES_COLLECTION));
    const unsubscribe = onSnapshot(invitesQuery, (snapshot) => {
      const fetchedInvites = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Invite));
      setInvites(fetchedInvites);
    }, (err) => {
      console.error("Chyba při načítání pozvánek: ", err);
      setError("Nepodařilo se načíst seznam pozvánek.");
    });
    return () => unsubscribe();
  }, [db]);

  const generateInvite = async () => {
    setIsLoading(true);
    setError('');
    try {
      const code = Math.random().toString(36).substring(2, 10).toUpperCase();
      await addDoc(collection(db, INVITES_COLLECTION), { code, createdAt: serverTimestamp() });
    } catch (err) {
      console.error("Chyba při generování pozvánky: ", err);
      setError("Nepodařilo se vygenerovat pozvánku.");
    } finally {
      setIsLoading(false);
    }
  };

  const deleteInvite = async (code: string) => {
    if (!window.confirm(`Opravdu chcete smazat kód pozvánky ${code}?`)) return;
    try {
      await deleteDoc(doc(db, INVITES_COLLECTION, code));
    } catch (err) {
      console.error("Chyba při mazání pozvánky: ", err);
      alert("Nepodařilo se smazat pozvánku.");
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4">
      <header className="mb-4 pb-2 border-b border-gray-300 flex justify-between items-center">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Správa pozvánek</h1>
        <button onClick={onBack} className="px-3 py-1 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 font-medium transition text-sm">Zpět</button>
      </header>
      <div className="bg-white p-6 rounded-xl shadow-lg">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-2">
          <h2 className="text-lg font-semibold">Aktivní kódy</h2>
          <button onClick={generateInvite} disabled={isLoading} className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-400 flex items-center justify-center text-sm">
            <Plus className="w-5 h-5 mr-2" />
            Vygenerovat pozvánku
          </button>
        </div>
        {error && <p className="text-red-500 mb-4 text-sm">{error}</p>}
        <div className="space-y-3">
          {invites.length === 0 && <p className="text-gray-500 text-center py-4 text-sm">Nejsou zde žádné aktivní pozvánky.</p>}
          {invites.map(invite => (
            <div key={invite.id} className="flex justify-between items-center bg-gray-50 p-3 rounded-lg border">
              <div className="flex items-center">
                <KeyRound className="w-5 h-5 text-green-600 mr-3" />
                <span className="font-mono text-lg tracking-widest text-gray-800">{invite.id}</span>
              </div>
              <button onClick={() => deleteInvite(invite.id)} className="text-red-500 hover:text-red-700 p-2 rounded-full hover:bg-red-100 transition" title="Smazat pozvánku">
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// --- PRINT ORDER TRACKER COMPONENT ---
const PrintOrderTracker: React.FC<{ user: FirebaseUser, db: Firestore, onManageUsers: () => void }> = ({ user, db, onManageUsers }) => {
  const [newOrderNumber, setNewOrderNumber] = useState("");
  const [newClientName, setNewClientName] = useState("");
  const [newDeliveryDate, setNewDeliveryDate] = useState("");
  const [newPrintTypes, setNewPrintTypes] = useState<string[]>(DEFAULT_PRINT_TYPES_INITIAL);
  const [isAdding, setIsAdding] = useState(false);

  const [orders, setOrders] = useState<Order[]>([]);
  const [editingCell, setEditingCell] = useState<{ orderId: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [confirmModal, setConfirmModal] = useState<{ message: string, onConfirm: () => void, onCancel: () => void } | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortState, setSortState] = useState<SortState>({ column: 'deliveryDate', direction: 'asc' });

  useEffect(() => {
    const ordersCollection = collection(db, PUBLIC_ORDERS_COLLECTION);
    const q = query(ordersCollection);
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const parsedOrders = snapshot.docs.map(doc => {
        const data = doc.data();
        let deliveryDate = "";
        if (data.deliveryDate) {
          if (typeof data.deliveryDate === 'string') {
            deliveryDate = data.deliveryDate.split('T')[0];
          } else if (data.deliveryDate.toDate && typeof data.deliveryDate.toDate === 'function') {
            deliveryDate = data.deliveryDate.toDate().toISOString().split('T')[0];
          } else if (data.deliveryDate.seconds) {
            deliveryDate = new Date(data.deliveryDate.seconds * 1000).toISOString().split('T')[0];
          }
        }

        // --- FALLBACK MAPPING FOR CML COMPATIBILITY (Safe Strings) ---
        const orderNumber = String(data.orderNumber || data.jobId || "???");
        const clientNameRaw = data.clientName || (data.customer ? (data.customer + (data.jobName ? " / " + data.jobName : "")) : "???");
        const clientName = String(clientNameRaw);
        const currentStage = String(data.currentStage || data.trackingStage || "studio") as Stage;
        const rawPrintType = Array.isArray(data.printType) ? data.printType : (data.technology || []);
        const printType = rawPrintType.map((t: any) => String(t || ""));

        return {
          ...data,
          id: doc.id,
          orderNumber,
          clientName,
          currentStage,
          printType,
          deliveryDate,
        } as Order;
      });
      setOrders(parsedOrders);
    }, (error) => {
      console.error("Chyba při načítání dat: ", error);
    });
    return () => unsubscribe();
  }, [db]);

  const toggleNewPrintType = (tech: string) => {
    setNewPrintTypes(currentTypes => {
      const isPresent = currentTypes.includes(tech);
      if (isPresent) return currentTypes.filter(t => t !== tech);
      return Array.from(new Set([...currentTypes, tech])).sort();
    });
  };

  const applySorting = (data: Order[]) => {
    const { column, direction } = sortState;
    const directionMultiplier = direction === 'asc' ? 1 : -1;
    return [...data].sort((a, b) => {
      let comparison = 0;
      if (!a.isCompleted && !b.isCompleted) {
        if (a.isUrgent && !b.isUrgent) return -1;
        if (!a.isUrgent && b.isUrgent) return 1;
      }
      if (column === 'clientName') {
        comparison = a.clientName?.localeCompare(b.clientName || "", 'cs') || 0;
      } else if (column === 'deliveryDate') {
        const dateA = new Date(a.deliveryDate || '2999-01-01').getTime();
        const dateB = new Date(b.deliveryDate || '2999-01-01').getTime();
        comparison = dateA - dateB;
      } else if (STAGE_ORDER.includes(column)) {
        if (column === 'completed') {
          comparison = (a.isCompleted ? 1 : 0) - (b.isCompleted ? 1 : 0);
        } else {
          comparison = (a.currentStage === column ? 0 : 1) - (b.currentStage === column ? 0 : 1);
        }
      }
      return comparison * directionMultiplier;
    });
  };

  const handleSort = (column: string) => {
    setSortState(prev => prev.column === column ? { column, direction: prev.direction === 'asc' ? 'desc' : 'asc' } : { column, direction: 'asc' });
  };

  const filteredAndSortedOrders = useMemo(() => {
    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    const filtered = orders.filter(order => {
      if (!lowerCaseSearchTerm) return true;

      const clientName = (order.clientName || "").toLowerCase();
      const notes = (order.notes || "").toLowerCase();
      const orderNumber = (order.orderNumber || "").toLowerCase();
      const jobId = (String((order as any).jobId || "")).toLowerCase();
      const customer = (String((order as any).customer || "")).toLowerCase();
      const printType = Array.isArray(order.printType) ? order.printType : [];

      return (
        clientName.includes(lowerCaseSearchTerm) ||
        notes.includes(lowerCaseSearchTerm) ||
        orderNumber.includes(lowerCaseSearchTerm) ||
        jobId.includes(lowerCaseSearchTerm) ||
        customer.includes(lowerCaseSearchTerm) ||
        printType.some((type: string) => String(type || "").toLowerCase().includes(lowerCaseSearchTerm))
      );
    });
    return applySorting(filtered);
  }, [orders, searchTerm, sortState]);

  const isValidOrder = () =>
    newOrderNumber.trim().length > 0 &&
    newClientName.trim().length > 0 &&
    newDeliveryDate.length > 0 &&
    !isNaN(new Date(newDeliveryDate).getTime()) &&
    newPrintTypes.length > 0;

  const addOrder = async () => {
    if (!isValidOrder() || isAdding) return;
    setIsAdding(true);
    const newOrder = {
      orderNumber: newOrderNumber.trim(),
      clientName: newClientName.trim(),
      deliveryDate: newDeliveryDate,
      currentStage: "studio" as Stage,
      isCompleted: false,
      isUrgent: false,
      printType: newPrintTypes,
      notes: "",
      createdAt: serverTimestamp(),
    };
    try {
      await addDoc(collection(db, PUBLIC_ORDERS_COLLECTION), newOrder);
      setNewOrderNumber("");
      setNewClientName("");
      setNewDeliveryDate("");
      setNewPrintTypes(DEFAULT_PRINT_TYPES_INITIAL);
    } catch (e) {
      console.error("Error adding document: ", e);
      alert("Chyba: Zakázku se nepodařilo uložit.");
    } finally {
      setIsAdding(false);
    }
  };

  const updateOrder = async (orderId: string, data: Partial<Omit<Order, 'id'>>) => {
    try {
      const orderRef = doc(db, PUBLIC_ORDERS_COLLECTION, orderId);
      await updateDoc(orderRef, data);
    } catch (e) {
      console.error("Error updating document: ", e);
    }
  };

  const toggleUrgency = (orderId: string, currentUrgency: boolean) => updateOrder(orderId, { isUrgent: !currentUrgency });

  const togglePrintTechnology = (orderId: string, currentTypes: string[], tech: string) => {
    const isPresent = currentTypes.includes(tech);
    let newTypes = [...currentTypes];
    if (isPresent) {
      if (newTypes.length > 1) newTypes = newTypes.filter(t => t !== tech);
      else return;
    } else {
      newTypes.push(tech);
    }
    updateOrder(orderId, { printType: Array.from(new Set(newTypes)).sort() });
  };

  const updateStage = (orderId: string, stage: Stage) => {
    let updateData: Partial<Order> = stage === "completed"
      ? { currentStage: "completed", isCompleted: true, isUrgent: false }
      : { currentStage: stage, isCompleted: false };
    updateOrder(orderId, updateData);
  };

  const startEditing = (orderId: string, field: string, value: string) => {
    setEditingCell({ orderId, field });
    setEditValue(value);
  };

  const updateOrderField = (orderId: string, field: string) => {
    if (field !== "notes" && !editValue.trim()) {
      setEditingCell(null);
      return;
    }
    updateOrder(orderId, { [field]: editValue });
    setEditingCell(null);
  };

  const handleEditKey = (e: React.KeyboardEvent<HTMLInputElement>, orderId: string, field: string) => {
    if (e.key === "Enter") updateOrderField(orderId, field);
    if (e.key === "Escape") setEditingCell(null);
  };

  const deleteOrder = async (orderId: string) => {
    try {
      await deleteDoc(doc(db, PUBLIC_ORDERS_COLLECTION, orderId));
    } catch (e) {
      console.error("Error deleting document: ", e);
    }
  };

  const handleDeleteClick = (orderId: string, orderNumber: string) => {
    setConfirmModal({
      message: `Opravdu chcete zakázku ${orderNumber} smazat? Tato akce je nevratná.`,
      onConfirm: () => { deleteOrder(orderId); setConfirmModal(null); },
      onCancel: () => setConfirmModal(null)
    });
  };

  const getRowColorClass = (order: Order) => {
    if (order.isCompleted) return "bg-purple-50 hover:bg-purple-100";
    if (order.isUrgent) return "bg-yellow-50 hover:bg-yellow-100 border-l-4 border-red-500";
    return "hover:bg-orange-50";
  };

  const getNotesCellClasses = (order: Order) => {
    if (order.isCompleted) return "bg-purple-50 text-purple-800";
    if (order.notes && order.notes.trim().length > 0) return "bg-red-100 text-red-800 font-semibold";
    return "text-gray-700";
  };

  const getStageClasses = (order: Order, stageName: Stage) => {
    const isActive = order.currentStage === stageName;
    if (isActive) return "bg-blue-600 text-white border-blue-600 font-bold hover:bg-blue-700 shadow-md";
    return "bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200 cursor-pointer";
  };

  const getCompletedClasses = (order: Order) => order.isCompleted ? "bg-purple-600 text-white border-purple-600 font-bold hover:bg-purple-700 shadow-md" : "bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200 cursor-pointer";

  const getLocalDate = (dateString: string) => {
    if (!dateString) return "—";
    const date = new Date(dateString + 'T00:00:00Z');
    return date.toLocaleDateString("cs-CZ", { timeZone: 'UTC' });
  };

  return (
    <div className="max-w-full mx-auto">
      <header className="mb-2 pb-1 border-b border-gray-300 flex justify-between items-center px-1">
        <div className="text-[10px] text-gray-400 font-mono">v1.0.4</div>
        <div className="flex items-center space-x-2 sm:space-x-3">
          <button onClick={onManageUsers} className="flex items-center px-2 py-0.5 bg-gray-600 text-white rounded-full hover:bg-gray-700 transition duration-150 shadow-sm font-medium text-[10px] sm:text-xs">
            <Users className="w-3 h-3 mr-1" />
            Správa
          </button>
          <span className="hidden sm:flex items-center text-xs text-gray-600">
            <User className="w-3 h-3 mr-1 text-blue-500" />
            {user.email}
          </span>
          <button onClick={() => auth && signOut(auth)} className="flex items-center px-2 py-0.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition duration-150 shadow-sm font-medium text-[10px] sm:text-xs">
            <LogOut className="w-3 h-3 mr-1" />
            Odhlásit
          </button>
        </div>
      </header>

      <div className={`rounded-xl border border-gray-200 p-3 sm:p-4 my-4 transition duration-300 ${newPrintTypes.length > 0 ? "bg-yellow-50" : "bg-gray-50"}`}>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3 pb-2 border-b border-gray-200 gap-2">
          <h2 className="text-lg font-semibold text-gray-700">Nová zakázka</h2>
          <input type="text" placeholder="Hledej zakázky..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition w-full sm:w-1/3 text-sm" />
        </div>
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3 items-end">
          <div className="w-full sm:w-[15%]">
            <input type="text" value={newOrderNumber} onChange={(e) => setNewOrderNumber(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" placeholder="Číslo" />
          </div>
          <div className="w-full sm:w-[35%]">
            <input type="text" value={newClientName} onChange={(e) => setNewClientName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" placeholder="Zákazník / Popis" />
          </div>
          <div className="w-full sm:w-[15%]">
            <div className="flex space-x-2">
              <button onClick={() => toggleNewPrintType(TECH_DIGITAL)} title="Digital (D)" className={`w-1/2 px-3 py-2 text-sm font-bold rounded-lg transition shadow-md ${newPrintTypes.includes(TECH_DIGITAL) ? 'bg-blue-600 text-white hover:bg-blue-700 ring-2 ring-blue-300' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>D</button>
              <button onClick={() => toggleNewPrintType(TECH_OFFSET)} title="Ofset (O)" className={`w-1/2 px-3 py-2 text-sm font-bold rounded-lg transition shadow-md ${newPrintTypes.includes(TECH_OFFSET) ? 'bg-orange-500 text-white hover:bg-orange-600 ring-2 ring-orange-300' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>O</button>
            </div>
          </div>
          <div className="w-full sm:w-[15%]">
            <input type="date" value={newDeliveryDate} onChange={(e) => setNewDeliveryDate(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
          </div>
          <div className="w-full sm:w-[20%]">
            <button onClick={addOrder} disabled={!isValidOrder() || isAdding} className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-300 font-semibold flex items-center justify-center space-x-2 disabled:bg-gray-400 disabled:cursor-not-allowed transition shadow-md text-sm h-[38px]">
              {isAdding ? "Pracuji..." : <><Plus className="w-4 h-4" /><span>Přidat</span></>}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-lg overflow-hidden mx-1">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-2 py-3 text-center text-sm font-medium text-gray-500 uppercase tracking-wider w-[60px] align-top">S.</th>
                <SortIndicator column="clientName" label="ZAKÁZKA / ZÁKAZNÍK" sortState={sortState} handleSort={handleSort} />
                <SortIndicator column="deliveryDate" label="TERMÍN" sortState={sortState} handleSort={handleSort} />
                <SortIndicator column="studio" label={STAGE_LABELS['studio']} sortState={sortState} handleSort={handleSort} />
                <SortIndicator column="print" label={STAGE_LABELS['print']} sortState={sortState} handleSort={handleSort} />
                <SortIndicator column="bookbinding" label={STAGE_LABELS['bookbinding']} sortState={sortState} handleSort={handleSort} />
                <SortIndicator column="completed" label={STAGE_LABELS['completed']} sortState={sortState} handleSort={handleSort} />
                <th className="px-3 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider min-w-[200px]">Poznámky</th>
                <th className="px-6 py-3 text-center text-sm font-medium text-gray-500 uppercase tracking-wider min-w-[60px]">Smazat</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredAndSortedOrders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-gray-500 text-lg">
                    {searchTerm ? `Žádné zakázky neodpovídají hledání "${searchTerm}".` : "Zatím nebyly přidány žádné zakázky."}
                  </td>
                </tr>
              ) : (
                filteredAndSortedOrders.map((order) => (
                  <tr key={order.id} className={`${getRowColorClass(order)} transition`}>
                    <td className="px-2 py-1 whitespace-nowrap text-center text-sm font-bold text-gray-700 w-[60px]">
                      <div className="flex flex-col space-y-1 items-center">
                        <button onClick={() => togglePrintTechnology(order.id, order.printType, TECH_DIGITAL)} className={`w-6 h-6 rounded-md transition font-bold text-xs flex items-center justify-center cursor-pointer ${order.printType?.includes(TECH_DIGITAL) ? (order.isCompleted ? 'bg-purple-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700') : (order.isCompleted ? 'bg-purple-200 text-purple-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300')}`}>D</button>
                        <button onClick={() => togglePrintTechnology(order.id, order.printType, TECH_OFFSET)} className={`w-6 h-6 rounded-md transition font-bold text-xs flex items-center justify-center cursor-pointer ${order.printType?.includes(TECH_OFFSET) ? (order.isCompleted ? 'bg-purple-600 text-white' : 'bg-orange-500 text-white hover:bg-orange-600') : (order.isCompleted ? 'bg-purple-200 text-purple-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300')}`}>O</button>
                      </div>
                    </td>
                    <td className={`px-3 py-2 text-sm font-medium ${order.isCompleted ? 'text-purple-800' : 'text-gray-900'}`}>
                      <div className="flex items-center justify-between w-full">
                        <div className="flex-1 min-w-0 pr-2">
                          {editingCell?.orderId === order.id && (editingCell?.field === "clientName" || editingCell?.field === "orderNumber") ? (
                            <div className="flex flex-col gap-1">
                              <input type="text" value={editValue} autoFocus onBlur={() => updateOrderField(order.id, editingCell.field)} onKeyDown={(e) => handleEditKey(e, order.id, editingCell.field)} onChange={(e) => setEditValue(e.target.value)} className="w-full px-2 py-1 border border-blue-400 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                            </div>
                          ) : (
                            <div className="flex flex-row items-center gap-2">
                              <span onClick={() => startEditing(order.id, "orderNumber", order.orderNumber || "")} className="text-sm font-bold font-mono bg-gray-100 text-gray-600 border border-gray-200 px-2 py-1 rounded cursor-pointer hover:bg-gray-200 hover:text-gray-900 transition flex-shrink-0">
                                {order.orderNumber || "???"}
                              </span>
                              <span onClick={() => startEditing(order.id, "clientName", order.clientName)} className="cursor-pointer truncate block text-sm font-semibold hover:underline">
                                {order.clientName}
                              </span>
                            </div>
                          )}
                        </div>
                        <button onClick={() => toggleUrgency(order.id, order.isUrgent)} className={`p-1 rounded-full transition ml-2 ${order.isUrgent ? 'bg-red-500 text-white hover:bg-red-600' : 'text-gray-300 hover:text-red-500 hover:bg-red-100'}`} title={order.isUrgent ? "Zrušit prioritu" : "Označit jako prioritu"}>
                          <AlertTriangle className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                    <td className={`px-2 py-2 whitespace-nowrap text-[11px] sm:text-xs font-medium text-center ${order.isCompleted ? "bg-purple-200 text-purple-900" : (order.deliveryDate && !isNaN(new Date(order.deliveryDate).getTime()) ? (() => { const today = new Date(); today.setHours(0, 0, 0, 0); const delivery = new Date(order.deliveryDate + 'T00:00:00Z'); const diffDays = Math.ceil((delivery.getTime() - today.getTime()) / (1000 * 3600 * 24)); if (diffDays > 3) return "bg-green-200 text-green-900"; if (diffDays >= 0) return "bg-orange-200 text-orange-900"; return "bg-red-200 text-red-900 font-bold"; })() : "")}`}>
                      {editingCell?.orderId === order.id && editingCell?.field === "deliveryDate" ? (
                        <input type="date" value={editValue} autoFocus onBlur={() => updateOrderField(order.id, "deliveryDate")} onKeyDown={(e) => handleEditKey(e, order.id, "deliveryDate")} onChange={(e) => setEditValue(e.target.value)} className="w-full px-1 py-1 border border-blue-400 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs" />
                      ) : (
                        <span onClick={() => startEditing(order.id, "deliveryDate", order.deliveryDate)} className="cursor-pointer transition w-full text-center hover:opacity-80 px-2 block" title="Editovat termín">
                          {getLocalDate(order.deliveryDate)}
                        </span>
                      )}
                    </td>
                    {(["studio", "print", "bookbinding"] as Stage[]).map((stage) => (
                      <td key={stage} className="px-2 py-2 whitespace-nowrap text-center">
                        <button onClick={() => updateStage(order.id, stage)} className={`px-2 py-1 rounded-full text-[10px] sm:text-xs font-semibold border ${getStageClasses(order, stage)} transition w-full max-w-[80px]`}>
                          {STAGE_LABELS[stage]}
                        </button>
                      </td>
                    ))}
                    <td className="px-2 py-2 whitespace-nowrap text-center">
                      <button onClick={() => updateStage(order.id, "completed")} className={`px-2 py-1 rounded-full text-[10px] sm:text-xs font-semibold border ${getCompletedClasses(order)} transition w-full max-w-[80px]`}>{STAGE_LABELS['completed']}</button>
                    </td>
                    <td className={`px-3 py-2 text-xs ${getNotesCellClasses(order)}`}>
                      {editingCell?.orderId === order.id && editingCell?.field === "notes" ? (
                        <input type="text" value={editValue} autoFocus onBlur={() => updateOrderField(order.id, "notes")} onKeyDown={(e) => handleEditKey(e, order.id, "notes")} onChange={(e) => setEditValue(e.target.value)} className="w-full px-2 py-1 border border-blue-400 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs" placeholder="Poznámka..." />
                      ) : (
                        <span onClick={() => startEditing(order.id, "notes", order.notes || "")} className="cursor-pointer px-1 py-1 rounded transition w-full text-left max-h-6 overflow-hidden text-ellipsis whitespace-nowrap block" title={order.notes || "Přidat poznámku"}>
                          {order.notes || <span className="text-gray-400 italic">...</span>}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-center">
                      <button onClick={() => handleDeleteClick(order.id, order.orderNumber || order.clientName)} className="text-red-500 hover:text-red-700 p-2 rounded-full hover:bg-red-100 transition" title="Smazat zakázku">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {confirmModal && (<CustomConfirm message={confirmModal.message} onConfirm={confirmModal.onConfirm} onCancel={confirmModal.onCancel} />)}
    </div>
  );
};

// --- MAIN APP COMPONENT (Auth Gate) ---
const App: React.FC = () => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [firebaseError, setFirebaseError] = useState('');
  const [isManagingUsers, setIsManagingUsers] = useState(false);

  useEffect(() => {
    if (!auth) {
      setFirebaseError("Firebase není nakonfigurován.");
      setIsLoading(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-600 font-sans">Načítání...</div>;
  }

  if (firebaseError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50 p-4 font-sans">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-lg text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-red-800 mb-2">Chyba</h2>
          <p className="text-gray-700">{firebaseError}</p>
        </div>
      </div>
    );
  }

  if (!user || !db) return <LoginPage />;

  return (
    <div className="min-h-screen bg-gray-100 p-2 sm:p-4 font-sans">
      {isManagingUsers ? (
        <UserManagementPage db={db} onBack={() => setIsManagingUsers(false)} />
      ) : (
        <PrintOrderTracker user={user} db={db} onManageUsers={() => setIsManagingUsers(true)} />
      )}
    </div>
  );
};

export default App;
