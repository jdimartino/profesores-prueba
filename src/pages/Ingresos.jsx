import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getCobros, getAlumnos, getClaseById } from '../firebase/db';

function formatDateObj(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function formatDateStrDisplay(dateStr) {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
}

function getInitials(n = '', a = '') { return `${n[0] || ''}${a[0] || ''}`.toUpperCase(); }

export default function Ingresos({ setPage }) {
    const { user } = useAuth();
    const uid = user.uid;

    const [loading, setLoading] = useState(true);
    const [cobros, setCobros] = useState([]);
    const [alumnosMap, setAlumnosMap] = useState({});
    
    // Default dates: First day of current month to today
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        return formatDateObj(new Date(d.getFullYear(), d.getMonth(), 1));
    });
    const [endDate, setEndDate] = useState(() => formatDateObj(new Date()));

    const [modalAlumno, setModalAlumno] = useState(null); // the specific grouped data to show details

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [cobroSnap, almSnap] = await Promise.all([
                    getCobros(uid),
                    getAlumnos(uid)
                ]);

                const alms = almSnap.docs.reduce((acc, doc) => {
                    acc[doc.id] = { id: doc.id, ...doc.data() };
                    return acc;
                }, {});
                setAlumnosMap(alms);

                // parse the timestamps locally
                const allCobros = cobroSnap.docs.map(d => {
                    const data = d.data();
                    let dateObj = new Date();
                    if (data.creadoEn && data.creadoEn.toDate) {
                        dateObj = data.creadoEn.toDate();
                    }
                    return {
                        id: d.id,
                        ...data,
                        fechaObj: dateObj,
                        fechaStr: formatDateObj(dateObj)
                    };
                });
                
                setCobros(allCobros);
            } catch (error) {
                console.error("Error loading for Ingresos", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [uid]);

    // Derived filtering
    const filteredCobros = cobros.filter(c => {
        return c.fechaStr >= startDate && c.fechaStr <= endDate && c.estado === 'Pagado';
    });

    const totalUSD = filteredCobros.reduce((acc, c) => acc + (c.importe_usd || 0), 0);
    const totalEUR = filteredCobros.reduce((acc, c) => acc + (c.importe_eur || 0), 0);
    const totalVES = filteredCobros.reduce((acc, c) => acc + (c.importe_ves || 0), 0);

    // Group by student
    const byStudent = {};
    filteredCobros.forEach(c => {
        if (!byStudent[c.alumnoId]) {
            byStudent[c.alumnoId] = {
                alumnoId: c.alumnoId,
                totalUSD: 0,
                totalEUR: 0,
                totalVES: 0,
                cobros: []
            };
        }
        byStudent[c.alumnoId].totalUSD += (c.importe_usd || 0);
        byStudent[c.alumnoId].totalEUR += (c.importe_eur || 0);
        byStudent[c.alumnoId].totalVES += (c.importe_ves || 0);
        byStudent[c.alumnoId].cobros.push(c);
    });

    const studentList = Object.values(byStudent).sort((a, b) => b.totalUSD - a.totalUSD); // sort by USD mostly

    return (
        <div>
            <div className="page-header" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button 
                    onClick={() => setPage('inicio')} 
                    style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', padding: '4px 8px' }}
                >
                    ←
                </button>
                <h1 className="page-title" style={{ margin: 0 }}>Ingresos</h1>
            </div>

            <div className="card mb-16" style={{ background: 'var(--surface)', padding: 16 }}>
                <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                    <div style={{ flex: 1 }}>
                        <label className="form-label" style={{ fontSize: '0.8rem' }}>Desde</label>
                        <input 
                            type="date" 
                            className="form-input" 
                            value={startDate} 
                            onChange={e => setStartDate(e.target.value)} 
                        />
                    </div>
                    <div style={{ flex: 1 }}>
                        <label className="form-label" style={{ fontSize: '0.8rem' }}>Hasta</label>
                        <input 
                            type="date" 
                            className="form-input" 
                            value={endDate} 
                            onChange={e => setEndDate(e.target.value)} 
                        />
                    </div>
                </div>

                <div style={{ textAlign: 'center', padding: '10px 0', borderTop: '1px solid var(--border)' }}>
                    <div className="text-secondary text-sm">Total Ingresado en Período</div>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 8 }}>
                        {totalUSD > 0 && <div className="font-bold text-green" style={{ fontSize: '1.2rem' }}>${totalUSD.toFixed(2)} USD</div>}
                        {totalEUR > 0 && <div className="font-bold text-green" style={{ fontSize: '1.2rem' }}>€{totalEUR.toFixed(2)} EUR</div>}
                    </div>
                    {totalVES > 0 && <div className="text-secondary" style={{ marginTop: 4, fontSize: '0.9rem' }}>Bs {totalVES.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>}
                    
                    {totalUSD === 0 && totalEUR === 0 && (
                        <div className="font-bold text-green" style={{ fontSize: '1.2rem' }}>$0.00 USD</div>
                    )}
                </div>
            </div>

            <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 12 }}>Resumen por Alumno</h2>

            {loading ? (
                <div className="empty-state"><span>⏳</span></div>
            ) : studentList.length === 0 ? (
                <div className="empty-state">
                    <span className="empty-state-icon">💸</span>
                    <span className="empty-state-text">No hay ingresos en este rango de fechas.</span>
                </div>
            ) : (
                studentList.map(summary => {
                    const a = alumnosMap[summary.alumnoId];
                    return (
                        <div 
                            key={summary.alumnoId} 
                            className="list-item" 
                            style={{ cursor: 'pointer' }}
                            onClick={() => setModalAlumno(summary)}
                        >
                            <div className="avatar" style={{ background: '#22c55e' }}>
                                {a ? getInitials(a.nombre, a.apellido) : '?'}
                            </div>
                            <div className="list-item-content">
                                <div className="list-item-title">{a ? `${a.nombre} ${a.apellido}` : 'Desconocido'}</div>
                                <div className="list-item-sub">{summary.cobros.length} pago(s) registrados</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                {summary.totalUSD > 0 && <div className="font-bold text-green" style={{ fontSize: '0.9rem' }}>${summary.totalUSD.toFixed(2)} USD</div>}
                                {summary.totalEUR > 0 && <div className="font-bold text-green" style={{ fontSize: '0.9rem' }}>€{summary.totalEUR.toFixed(2)} EUR</div>}
                            </div>
                        </div>
                    );
                })
            )}

            {modalAlumno && (
                <IngresosDetalleModal 
                    uid={uid}
                    summary={modalAlumno} 
                    alumno={alumnosMap[modalAlumno.alumnoId]} 
                    onClose={() => setModalAlumno(null)} 
                />
            )}
        </div>
    );
}

function IngresosDetalleModal({ uid, summary, alumno, onClose }) {
    return (
        <div className="overlay" onClick={onClose}>
            <div className="bottom-sheet" onClick={e => e.stopPropagation()}>
                <div className="sheet-handle" />
                <div className="sheet-title">Detalles: {alumno?.nombre} {alumno?.apellido}</div>

                <div className="card mb-16">
                    <div className="flex-between mb-8" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
                        <span className="font-bold">Total Alumno</span>
                        <div style={{ textAlign: 'right' }}>
                            {summary.totalUSD > 0 && <div className="font-bold text-green">${summary.totalUSD.toFixed(2)} USD</div>}
                            {summary.totalEUR > 0 && <div className="font-bold text-green">€{summary.totalEUR.toFixed(2)} EUR</div>}
                            {summary.totalVES > 0 && <div className="text-secondary text-sm">Bs {summary.totalVES.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</div>}
                        </div>
                    </div>

                    <p className="text-secondary text-sm mb-8" style={{ marginTop: 12 }}>Historial de pagos en el periodo:</p>
                    
                    {summary.cobros.sort((a, b) => b.fechaObj - a.fechaObj).map(c => {
                        const dateStrDisplay = formatDateStrDisplay(c.fechaStr);
                        const timeStr = c.fechaObj ? c.fechaObj.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: true }) : '';
                        
                        let subtotalText = [];
                        if (c.importe_usd > 0) subtotalText.push(`$${c.importe_usd.toFixed(2)} USD`);
                        if (c.importe_eur > 0) subtotalText.push(`€${c.importe_eur.toFixed(2)} EUR`);
                        
                        return (
                            <div key={c.id} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: '1px dashed var(--border)' }}>
                                <div className="flex-between" style={{ fontSize: '0.85rem', marginBottom: 4 }}>
                                    <span style={{ fontWeight: 600 }}>{dateStrDisplay} {timeStr}</span>
                                    <span style={{ fontWeight: 600, color: 'var(--text)' }}>
                                        {subtotalText.join(' + ')}
                                    </span>
                                </div>
                                <div className="flex-between" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                    <span>{c.metodo_pago}</span>
                                    <span>{c.claseIds?.length || 0} clases</span>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                    <button className="btn btn-primary btn-full" onClick={onClose}>Cerrar</button>
                </div>
            </div>
        </div>
    );
}
