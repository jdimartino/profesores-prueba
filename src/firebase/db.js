import {
    collection, doc, addDoc, updateDoc, deleteDoc,
    getDocs, query, orderBy, where, serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase';

// ---- ALUMNOS ----
export const getAlumnos = (uid) =>
    getDocs(query(collection(db, 'profesores', uid, 'alumnos'), orderBy('nombre')));

export const addAlumno = (uid, data) =>
    addDoc(collection(db, 'profesores', uid, 'alumnos'), { ...data, activo: true, creadoEn: serverTimestamp() });

export const updateAlumno = (uid, id, data) =>
    updateDoc(doc(db, 'profesores', uid, 'alumnos', id), data);

export const deleteAlumno = (uid, id) =>
    updateDoc(doc(db, 'profesores', uid, 'alumnos', id), { activo: false });

// ---- CLASES ----
export const getClases = (uid) =>
    getDocs(query(collection(db, 'profesores', uid, 'clases'), orderBy('fecha', 'desc')));

export const getClasesByDate = (uid, dateStr) =>
    getDocs(query(
        collection(db, 'profesores', uid, 'clases'),
        where('fechaStr', '==', dateStr),
        orderBy('horaInicio')
    ));

export const getClasesByDateStartEnd = (uid, startStr, endStr) =>
    getDocs(query(
        collection(db, 'profesores', uid, 'clases'),
        where('fechaStr', '>=', startStr),
        where('fechaStr', '<=', endStr),
        orderBy('fechaStr'),
        orderBy('horaInicio')
    ));

export const getClasesPendientesDeCobro = (uid) =>
    getDocs(query(
        collection(db, 'profesores', uid, 'clases'),
        where('estado', '==', 'Completada'),
        where('cobrada', '==', false)
    ));

export const addClase = (uid, data) =>
    addDoc(collection(db, 'profesores', uid, 'clases'), { ...data, cobrada: false, creadoEn: serverTimestamp() });

export const updateClase = (uid, id, data) =>
    updateDoc(doc(db, 'profesores', uid, 'clases'), data);

export const updateClaseById = (uid, id, data) =>
    updateDoc(doc(db, 'profesores', uid, 'clases', id), data);

// ---- COBROS ----
export const getCobros = (uid) =>
    getDocs(query(collection(db, 'profesores', uid, 'cobros'), orderBy('creadoEn', 'desc')));

export const addCobro = (uid, data) =>
    addDoc(collection(db, 'profesores', uid, 'cobros'), { ...data, creadoEn: serverTimestamp() });

export const updateCobro = (uid, id, data) =>
    updateDoc(doc(db, 'profesores', uid, 'cobros', id), data);

// ---- PERFIL ----
export const getPerfil = (uid) =>
    getDocs(query(collection(db, 'profesores', uid, 'perfil')));

export const updatePerfil = (uid, data) =>
    updateDoc(doc(db, 'profesores', uid, 'perfil', 'datos'), data);

export const setPerfil = (uid, data) =>
    import('firebase/firestore').then(({ setDoc }) =>
        setDoc(doc(db, 'profesores', uid, 'perfil', 'datos'), data, { merge: true })
    );
