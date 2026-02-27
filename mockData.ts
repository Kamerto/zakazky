export type Stage = 'studio' | 'print' | 'bookbinding' | 'completed';

export interface Order {
    id: string;
    orderNumber: string;
    clientName: string;
    currentStage: Stage;
    notes: string;
    isCompleted: boolean;
    isUrgent: boolean;
    deliveryDate: string;
    printType: string[];
    createdAt?: any;
}

export const MOCK_ORDERS: Order[] = [
    {
        id: 'mock-1',
        orderNumber: '2024/001',
        clientName: 'Testovní Klient A',
        currentStage: 'studio',
        notes: 'Toto je testovací zakázka v režimu sandbox.',
        isCompleted: false,
        isUrgent: true,
        deliveryDate: new Date().toISOString().split('T')[0],
        printType: ['DIGITAL']
    },
    {
        id: 'mock-2',
        orderNumber: '2024/002',
        clientName: 'Ukázková Firma s.r.o.',
        currentStage: 'print',
        notes: 'Druhá testovací zakázka.',
        isCompleted: false,
        isUrgent: false,
        deliveryDate: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
        printType: ['OFFSET']
    }
];
