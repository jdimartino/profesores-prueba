import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getAlumnos, getClases, getClasesPendientesDeCobro, addCobro, getCobros, updateCobro, updateClaseById, getClaseById } from '../firebase/db';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

const COLORS = ['#22c55e', '#3b82f6', '#f97316', '#a855f7', '#14b8a6', '#f43f5e', '#eab308'];
const METODOS = ['Efectivo USD', 'Efectivo Bs', 'Zelle', 'Transferencia', 'Pago Móvil', 'Otro'];

function getInitials(n = '', a = '') { return `${n[0] || ''}${a[0] || ''}`.toUpperCase(); }

function formatDate(dateStr) {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
}

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
    const [tasas, setTasas] = useState({ USD: 0, EUR: 0 });
    const [fechaTasas, setFechaTasas] = useState('');
    const [cobroModal, setCobroModal] = useState(null); // { alumno, clases }
    const [historialSelected, setHistorialSelected] = useState(null);

    const load = async () => {
        setLoading(true);
        try {
            const [almSnap, clasSnap, cobroSnap] = await Promise.all([
                getAlumnos(uid),
                getClasesPendientesDeCobro(uid),
                getCobros(uid),
            ]);

            // Fetch official exchange rates
            try {
                const [usdRes, eurRes] = await Promise.all([
                    fetch('https://ve.dolarapi.com/v1/dolares/oficial').then(r => r.json()),
                    fetch('https://ve.dolarapi.com/v1/euros/oficial').then(r => r.json())
                ]);
                setTasas({
                    USD: usdRes?.promedio || 0,
                    EUR: eurRes?.promedio || 0
                });
                
                if (usdRes?.fechaActualizacion) {
                    const d = new Date(usdRes.fechaActualizacion);
                    setFechaTasas(d.toLocaleString('es-VE', { 
                        day: '2-digit', month: '2-digit', 
                        hour: '2-digit', minute: '2-digit', hour12: true 
                    }));
                }
            } catch (e) {
                console.error("Error fetching rates", e);
            }

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
                let importeUSD = 0;
                let importeEUR = 0;
                
                clases.forEach(c => {
                    // Try to use the specific class tarifa, fallback to calculating based on alumno tarifa if missing
                    const tarifaCalculada = c.tarifa !== undefined && c.tarifa !== "" 
                        ? Number(c.tarifa) 
                        : (alumno ? ((c.duracion_min || 60) / 60) * alumno.tarifa_usd : 0);
                    c.importeCalculado = tarifaCalculada;
                    const m = c.moneda || 'USD';
                    if (m === 'EUR') importeEUR += tarifaCalculada;
                    else importeUSD += tarifaCalculada;
                });

                return { alumnoId, alumno, clases: clases.sort((a,b) => a.fechaStr.localeCompare(b.fechaStr)), totalMin, importeUSD, importeEUR };
            });
            setPendientes(pends);

            setHistorial(cobroSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const handleCobrar = (item) => setCobroModal(item);

    const handleWhatsApp = (item) => {
        const importeVes = ((item.importeUSD * tasas.USD) + (item.importeEUR * tasas.EUR)).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const alumnoNombre = item.alumno ? `${item.alumno.nombre}` : 'Alumno';
        
        let subtotalText = [];
        if (item.importeUSD > 0) subtotalText.push(`$${item.importeUSD.toFixed(2)} USD`);
        if (item.importeEUR > 0) subtotalText.push(`€${item.importeEUR.toFixed(2)} EUR`);
        const subtotalStr = subtotalText.join(' + ');

        let mensaje = `Hola ${alumnoNombre}, tienes un saldo pendiente por clases de tenis de ${subtotalStr} (Bs ${importeVes}).\n`;
        if (fechaTasas) {
             if (item.importeEUR > 0) mensaje += `*Tasa Euros BCV ${tasas.EUR.toLocaleString('es-VE')} al ${fechaTasas}*\n`;
             if (item.importeUSD > 0) mensaje += `*Tasa Dólares BCV ${tasas.USD.toLocaleString('es-VE')} al ${fechaTasas}*\n`;
        }
        mensaje += `\nDetalle:\n`;
        
        item.clases.forEach(c => {
            const sym = (c.moneda === 'EUR') ? '€' : '$';
            mensaje += `- ${formatDate(c.fechaStr)} ${c.horaInicio} - ${c.cancha ? c.cancha : 'Cancha'}: ${sym}${c.importeCalculado.toFixed(2)}\n`;
        });
        
        const telefono = item.alumno?.telefono || '';
        const phoneParam = telefono.replace(/\D/g, ''); 
        
        const url = `https://wa.me/${phoneParam}?text=${encodeURIComponent(mensaje)}`;
        window.open(url, '_blank');
    };

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
                        const importeVes = ((item.importeUSD * tasas.USD) + (item.importeEUR * tasas.EUR)).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                        
                        let subtotalText = [];
                        if (item.importeUSD > 0) subtotalText.push(`$${item.importeUSD.toFixed(2)} USD`);
                        if (item.importeEUR > 0) subtotalText.push(`€${item.importeEUR.toFixed(2)} EUR`);
                        const subtotalStr = subtotalText.join(' + ');

                        return (
                            <div key={item.alumnoId} style={{ background: 'var(--surface)', borderRadius: 12, marginBottom: 12, padding: 16 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                    <div className="avatar" style={{ background: color }}>
                                        {a ? getInitials(a.nombre, a.apellido) : '?'}
                                    </div>
                                    <div className="list-item-content" style={{ flex: 1 }}>
                                        <div className="list-item-title">{a ? `${a.nombre} ${a.apellido}` : 'Alumno'}</div>
                                        <div className="list-item-sub">{item.clases.length} sesiones · {subtotalStr}</div>
                                        <div className="list-item-sub text-muted">Bs {importeVes}</div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        <button 
                                            className="btn btn-outline btn-sm" 
                                            style={{ padding: '0 10px', borderColor: '#25D366', color: '#25D366' }}
                                            onClick={() => handleWhatsApp(item)}
                                            title="Notificar por WhatsApp"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                                <path d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c-.003 1.396.366 2.76 1.057 3.965L0 16l4.204-1.102a7.933 7.933 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.729.729 0 0 0-.529.247c-.182.198-.691.677-.691 1.654 0 .977.71 1.916.81 2.049.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232z"/>
                                            </svg>
                                        </button>
                                        <button className="btn btn-primary btn-sm" onClick={() => handleCobrar(item)}>
                                            Cobrar
                                        </button>
                                    </div>
                                </div>
                                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                                    {item.clases.map(c => {
                                        const sym = (c.moneda === 'EUR') ? '€' : '$';
                                        return (
                                            <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 6 }}>
                                                <span>{formatDate(c.fechaStr)} · {c.horaInicio} · {c.cancha}</span>
                                                <span style={{ fontWeight: 600 }}>{sym}{c.importeCalculado.toFixed(2)}</span>
                                            </div>
                                        );
                                    })}
                                </div>
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
                        const fecha = c.creadoEn?.toDate ? c.creadoEn.toDate().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
                        return (
                            <div key={c.id} className="list-item" style={{ cursor: 'pointer' }} onClick={() => setHistorialSelected(c)}>
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
                    tasas={tasas}
                    fechaTasas={fechaTasas}
                    onClose={() => setCobroModal(null)}
                    onSaved={() => { setCobroModal(null); load(); }}
                />
            )}

            {historialSelected && (
                <HistorialModal
                    uid={uid}
                    item={historialSelected}
                    alumno={alumnoMap[historialSelected.alumnoId]}
                    onClose={() => setHistorialSelected(null)}
                />
            )}
        </div>
    );
}

function CobroModal({ uid, item, tasas, fechaTasas, onClose, onSaved }) {
    const { alumno, clases, importeUSD, importeEUR } = item;
    const [metodo, setMetodo] = useState('Efectivo USD');
    const [saving, setSaving] = useState(false);
    
    const totalVesNumber = (importeUSD * tasas.USD) + (importeEUR * tasas.EUR);
    const importeVes = totalVesNumber.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    let subtotalText = [];
    if (importeUSD > 0) subtotalText.push(`$${importeUSD.toFixed(2)} USD`);
    if (importeEUR > 0) subtotalText.push(`€${importeEUR.toFixed(2)} EUR`);
    const subtotalStr = subtotalText.join(' + ');

    const buildWhatsAppMsg = () => {
        const sym = (c) => c.moneda === 'EUR' ? '€' : '$';
        const sesiones = clases.map(c => `• ${formatDate(c.fechaStr)} ${c.horaInicio} (${c.duracion_min} min) - ${sym}${c.importeCalculado.toFixed(2)}`).join('\n');
        
        let msg = `Hola ${alumno?.nombre}! 🎾\n\nResumen de tus clases:\n${sesiones}\n\n`;
        msg += `Total: ${subtotalStr} / Bs ${importeVes}\n`;
        if (fechaTasas) {
            if (importeEUR > 0) msg += `*Tasa Euros BCV ${tasas.EUR.toLocaleString('es-VE')} al ${fechaTasas}*\n`;
            if (importeUSD > 0) msg += `*Tasa Dólares BCV ${tasas.USD.toLocaleString('es-VE')} al ${fechaTasas}*\n`;
        }
        msg += `Método de pago: ${metodo}\n\n¡Gracias! 🎾`;
        return encodeURIComponent(msg);
    };

    const handleConfirm = async () => {
        setSaving(true);
        try {
            const cobroData = {
                alumnoId: item.alumnoId,
                claseIds: clases.map(c => c.id),
                importe_usd: importeUSD,
                importe_eur: importeEUR,
                importe_ves: totalVesNumber,
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
                        <span className="text-secondary text-sm" style={{ alignSelf: 'flex-start' }}>Sesiones ({clases.length})</span>
                        <div style={{ textAlign: 'right' }}>
                            {clases.map(c => {
                                const sym = (c.moneda === 'EUR') ? '€' : '$';
                                return (
                                    <div key={c.id} style={{ fontSize: '0.85rem', marginBottom: 4, color: 'var(--text-secondary)' }}>
                                        {formatDate(c.fechaStr)} · {c.horaInicio} · {c.cancha} <strong style={{ color: 'var(--text)' }}>{sym}{c.importeCalculado.toFixed(2)}</strong>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    <div className="flex-between mb-8" style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                        <span className="font-bold">Total (USD/EUR)</span>
                        <span className="font-bold text-green">{subtotalStr}</span>
                    </div>
                    <div className="flex-between mb-4">
                        <span className="text-secondary text-sm">Total Bs</span>
                        <span className="font-bold text-green">Bs {importeVes}</span>
                    </div>
                    {fechaTasas && (
                         <div style={{ textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                             {importeEUR > 0 && <div>Tasa Euros BCV {tasas.EUR.toLocaleString('es-VE')} al {fechaTasas}</div>}
                             {importeUSD > 0 && <div>Tasa Dólares BCV {tasas.USD.toLocaleString('es-VE')} al {fechaTasas}</div>}
                         </div>
                    )}
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

function HistorialModal({ uid, item, alumno, onClose }) {
    const [clases, setClases] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchClases = async () => {
            if (!item.claseIds || item.claseIds.length === 0) {
                setLoading(false);
                return;
            }
            try {
                const results = await Promise.all(item.claseIds.map(id => getClaseById(uid, id)));
                setClases(results.filter(Boolean));
            } catch (error) {
                console.error("Error fetching clases", error);
            } finally {
                setLoading(false);
            }
        };
        fetchClases();
    }, [item, uid]);

    const fecha = item.creadoEn?.toDate ? item.creadoEn.toDate().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : '—';

    let subtotalText = [];
    if (item.importe_usd > 0) subtotalText.push(`$${item.importe_usd.toFixed(2)} USD`);
    if (item.importe_eur > 0) subtotalText.push(`€${item.importe_eur.toFixed(2)} EUR`);
    const subtotalStr = subtotalText.join(' + ');
    const importeVes = item.importe_ves ? Number(item.importe_ves).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00';

    return (
        <div className="overlay" onClick={onClose}>
            <div className="bottom-sheet" onClick={e => e.stopPropagation()}>
                <div className="sheet-handle" />
                <div className="sheet-title">Detalle de Pago</div>

                <div className="card mb-16">
                    <div className="flex-between mb-8">
                        <span className="text-secondary text-sm">Alumno</span>
                        <span className="font-bold">{alumno?.nombre} {alumno?.apellido}</span>
                    </div>
                    <div className="flex-between mb-8">
                        <span className="text-secondary text-sm">Fecha de pago</span>
                        <span style={{ fontSize: '0.9rem' }}>{fecha}</span>
                    </div>
                    <div className="flex-between mb-8">
                        <span className="text-secondary text-sm">Método de pago</span>
                        <span style={{ fontSize: '0.9rem' }}>{item.metodo_pago}</span>
                    </div>
                    <div className="flex-between mb-8">
                        <span className="text-secondary text-sm">Estado</span>
                        <span className={`badge ${item.estado === 'Pagado' ? 'badge-green' : 'badge-warning'}`}>{item.estado}</span>
                    </div>
                    
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                        <span className="text-secondary text-sm mb-8" style={{ display: 'block' }}>Clases pagadas ({item.claseIds?.length || 0})</span>
                        {loading ? (
                             <div className="text-center text-sm text-secondary py-4">Cargando clases...</div>
                        ) : (
                             clases.map(c => {
                                 const sym = (c.moneda === 'EUR') ? '€' : '$';
                                 return (
                                     <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 4, color: 'var(--text-secondary)' }}>
                                         <span>{formatDate(c.fechaStr)} · {c.horaInicio} · {c.cancha || 'Cancha'}</span>
                                         <strong style={{ color: 'var(--text)' }}>
                                            {sym}{(c.tarifa !== undefined && c.tarifa !== "" ? Number(c.tarifa) : (alumno ? ((c.duracion_min || 60) / 60) * alumno.tarifa_usd : 0)).toFixed(2)}
                                         </strong>
                                     </div>
                                 );
                             })
                        )}
                    </div>

                    <div className="flex-between mb-8" style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                        <span className="font-bold">Total Pagado</span>
                        <span className="font-bold text-green">{subtotalStr}</span>
                    </div>
                    {importeVes !== '0,00' && (
                        <div className="flex-between">
                            <span className="text-secondary text-sm">Equivalente Bs</span>
                            <span className="font-bold text-green">Bs {importeVes}</span>
                        </div>
                    )}
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                    <button className="btn btn-primary btn-full" onClick={onClose}>Cerrar</button>
                </div>
            </div>
        </div>
    );
}
