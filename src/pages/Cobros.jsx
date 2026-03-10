import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getAlumnos, getClases, getClasesPendientesDeCobro, addCobro, getCobros, updateCobro, updateClaseById } from '../firebase/db';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

const COLORS = ['#22c55e', '#3b82f6', '#f97316', '#a855f7', '#14b8a6', '#f43f5e', '#eab308'];
const METODOS = ['Efectivo USD', 'Efectivo Bs', 'Zelle', 'Transferencia', 'Pago Móvil', 'Otro'];

function getInitials(n = '', a = '') { return `${n[0] || ''}${a[0] || ''}`.toUpperCase(); }

export default function Cobros() {
    const { user } = useAuth();
    const uid = user.uid;
    const [tab, setTab] = useState('pendientes');
    const [pendientes, setPendientes] = useState([]);
    const [historial, setHistorial] = useState([]);
    const [alumnos, setAlumnos] = useState([]);
    const [alumnoMap, setAlumnoMap] = useState({});
    const [colorMap, setColorMap] = useState({});
    const [loading, setLoading] = useState(true);
    const [tasaCambio, setTasaCambio] = useState(1);
    const [cobroModal, setCobroModal] = useState(null); // { alumno, clases }

    const load = async () => {
        setLoading(true);
        try {
            const [almSnap, clasSnap, cobroSnap] = await Promise.all([
                getAlumnos(uid),
                getClasesPendientesDeCobro(uid),
                getCobros(uid),
            ]);

            // Load tasa de cambio from profile
            try {
                const perfilDoc = await getDoc(doc(db, 'profesores', uid, 'perfil', 'datos'));
                if (perfilDoc.exists()) setTasaCambio(perfilDoc.data().tasa_cambio || 1);
            } catch { }

            const alms = almSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(a => a.activo !== false);
            const aMap = {};
            const cMap = {};
            alms.forEach((a, i) => { aMap[a.id] = a; cMap[a.id] = COLORS[i % COLORS.length]; });
            setAlumnos(alms);
            setAlumnoMap(aMap);
            setColorMap(cMap);

            // Group pending classes by alumno
            const clasesByAlumno = {};
            clasSnap.docs.forEach(d => {
                const c = { id: d.id, ...d.data() };
                if (!clasesByAlumno[c.alumnoId]) clasesByAlumno[c.alumnoId] = [];
                clasesByAlumno[c.alumnoId].push(c);
            });

            const pends = Object.entries(clasesByAlumno).map(([alumnoId, clases]) => {
                const alumno = aMap[alumnoId];
                const totalMin = clases.reduce((s, c) => s + (c.duracion_min || 60), 0);
                const importeUSD = alumno ? (totalMin / 60) * alumno.tarifa_usd : 0;
                return { alumnoId, alumno, clases, totalMin, importeUSD };
            });
            setPendientes(pends);

            setHistorial(cobroSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const handleCobrar = (item) => setCobroModal(item);

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">Cobros</h1>
            </div>

            <div className="tabs">
                <button className={`tab-btn ${tab === 'pendientes' ? 'active' : ''}`} onClick={() => setTab('pendientes')}>
                    Pendientes {pendientes.length > 0 && `(${pendientes.length})`}
                </button>
                <button className={`tab-btn ${tab === 'historial' ? 'active' : ''}`} onClick={() => setTab('historial')}>
                    Historial
                </button>
            </div>

            {loading ? (
                <div className="empty-state"><span>⏳</span></div>
            ) : tab === 'pendientes' ? (
                pendientes.length === 0 ? (
                    <div className="empty-state">
                        <span className="empty-state-icon">✅</span>
                        <span className="empty-state-text">¡Todo al día! No hay cobros pendientes.</span>
                    </div>
                ) : (
                    pendientes.map((item, i) => {
                        const a = item.alumno;
                        const color = colorMap[item.alumnoId] || '#22c55e';
                        const importeVes = (item.importeUSD * tasaCambio).toLocaleString('es-VE');
                        return (
                            <div key={item.alumnoId} className="list-item" style={{ alignItems: 'center' }}>
                                <div className="avatar" style={{ background: color }}>
                                    {a ? getInitials(a.nombre, a.apellido) : '?'}
                                </div>
                                <div className="list-item-content">
                                    <div className="list-item-title">{a ? `${a.nombre} ${a.apellido}` : 'Alumno'}</div>
                                    <div className="list-item-sub">{item.clases.length} sesiones · ${item.importeUSD.toFixed(2)} USD</div>
                                    <div className="list-item-sub text-muted">Bs {importeVes}</div>
                                </div>
                                <button className="btn btn-primary btn-sm" onClick={() => handleCobrar(item)}>
                                    Cobrar
                                </button>
                            </div>
                        );
                    })
                )
            ) : (
                historial.length === 0 ? (
                    <div className="empty-state">
                        <span className="empty-state-icon">📋</span>
                        <span className="empty-state-text">Aún no hay cobros registrados.</span>
                    </div>
                ) : (
                    historial.map((c) => {
                        const a = alumnoMap[c.alumnoId];
                        const color = colorMap[c.alumnoId] || '#22c55e';
                        const fecha = c.creadoEn?.toDate ? c.creadoEn.toDate().toLocaleDateString('es-ES') : '—';
                        return (
                            <div key={c.id} className="list-item">
                                <div className="avatar" style={{ background: color }}>
                                    {a ? getInitials(a.nombre, a.apellido) : '?'}
                                </div>
                                <div className="list-item-content">
                                    <div className="list-item-title">{a ? `${a.nombre} ${a.apellido}` : 'Alumno'}</div>
                                    <div className="list-item-sub">{c.claseIds?.length || 0} sesiones · ${c.importe_usd?.toFixed(2)} USD</div>
                                    <div className="list-item-sub text-muted">{fecha} · {c.metodo_pago}</div>
                                </div>
                                <span className={`badge ${c.estado === 'Pagado' ? 'badge-green' : 'badge-warning'}`}>{c.estado}</span>
                            </div>
                        );
                    })
                )
            )}

            {cobroModal && (
                <CobroModal
                    uid={uid}
                    item={cobroModal}
                    tasaCambio={tasaCambio}
                    onClose={() => setCobroModal(null)}
                    onSaved={() => { setCobroModal(null); load(); }}
                />
            )}
        </div>
    );
}

function CobroModal({ uid, item, tasaCambio, onClose, onSaved }) {
    const { alumno, clases, importeUSD } = item;
    const [metodo, setMetodo] = useState('Efectivo USD');
    const [saving, setSaving] = useState(false);
    const importeVes = (importeUSD * tasaCambio).toLocaleString('es-VE');

    const buildWhatsAppMsg = () => {
        const sesiones = clases.map(c => `• ${c.fechaStr} ${c.horaInicio} (${c.duracion_min} min)`).join('\n');
        const msg = `Hola ${alumno?.nombre}! 🎾\n\nResumen de tus clases:\n${sesiones}\n\nTotal: $${importeUSD.toFixed(2)} USD / Bs ${importeVes}\nMétodo de pago: ${metodo}\n\n¡Gracias! 🎾`;
        return encodeURIComponent(msg);
    };

    const handleConfirm = async () => {
        setSaving(true);
        try {
            const cobroData = {
                alumnoId: item.alumnoId,
                claseIds: clases.map(c => c.id),
                importe_usd: importeUSD,
                importe_ves: importeUSD * tasaCambio,
                metodo_pago: metodo,
                estado: 'Pagado',
            };
            await addCobro(uid, cobroData);
            // Mark all classes as cobradas
            await Promise.all(clases.map(c => updateClaseById(uid, c.id, { cobrada: true })));
            // Open WhatsApp
            const tel = alumno?.telefono?.replace(/\D/g, '');
            if (tel) {
                window.open(`https://wa.me/${tel}?text=${buildWhatsAppMsg()}`, '_blank');
            }
            onSaved();
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="overlay" onClick={onClose}>
            <div className="bottom-sheet" onClick={e => e.stopPropagation()}>
                <div className="sheet-handle" />
                <div className="sheet-title">Confirmar Cobro</div>

                <div className="card mb-16">
                    <div className="flex-between mb-8">
                        <span className="text-secondary text-sm">Alumno</span>
                        <span className="font-bold">{alumno?.nombre} {alumno?.apellido}</span>
                    </div>
                    <div className="flex-between mb-8">
                        <span className="text-secondary text-sm">Sesiones</span>
                        <span className="font-bold">{clases.length}</span>
                    </div>
                    <div className="flex-between mb-8">
                        <span className="text-secondary text-sm">Total USD</span>
                        <span className="font-bold text-green">${importeUSD.toFixed(2)}</span>
                    </div>
                    <div className="flex-between">
                        <span className="text-secondary text-sm">Total Bs</span>
                        <span className="font-bold text-green">Bs {importeVes}</span>
                    </div>
                </div>

                <div className="form-group">
                    <label className="form-label">Método de Pago</label>
                    <select className="form-select" value={metodo} onChange={e => setMetodo(e.target.value)}>
                        {METODOS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
                    <button className="btn btn-whatsapp btn-full" onClick={handleConfirm} disabled={saving}>
                        📲 {saving ? 'Registrando...' : 'Registrar y Enviar por WhatsApp'}
                    </button>
                    <button className="btn btn-outline btn-full" onClick={onClose}>Cancelar</button>
                </div>
            </div>
        </div>
    );
}
