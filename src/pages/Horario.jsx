import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getClasesByDateStartEnd, updateClaseById, getAlumnos, getClasesByDate } from '../firebase/db';

// Colores por alumno (ciclado)
const COLORS = ['#22c55e', '#3b82f6', '#f97316', '#a855f7', '#14b8a6', '#f43f5e', '#eab308'];
const HOURS = Array.from({ length: 17 }, (_, i) => i + 6); // 6:00 - 22:00

function dateToStr(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatDay(date) {
    return date.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
}

function getStartOfWeek(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Lunes
    return new Date(d.setDate(diff));
}

function getStartOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
}

export default function Horario() {
    const { user } = useAuth();
    const uid = user.uid;
    const [viewMode, setViewMode] = useState('diaria'); // diaria, semanal, mensual
    const [currentDate, setCurrentDate] = useState(new Date());
    const [clases, setClases] = useState([]);
    const [alumnos, setAlumnos] = useState([]);
    const [alumnoMap, setAlumnoMap] = useState({});
    const [colorMap, setColorMap] = useState({});
    const [showModal, setShowModal] = useState(false);
    const [showDetail, setShowDetail] = useState(null);
    const [loading, setLoading] = useState(true);

    const loadData = async () => {
        setLoading(true);
        try {
            let clasSnap;
            if (viewMode === 'diaria') {
                clasSnap = await getClasesByDate(uid, dateToStr(currentDate));
            } else if (viewMode === 'semanal') {
                const start = getStartOfWeek(currentDate);
                const end = new Date(start);
                end.setDate(start.getDate() + 6);
                clasSnap = await getClasesByDateStartEnd(uid, dateToStr(start), dateToStr(end));
            } else {
                const start = getStartOfMonth(currentDate);
                const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
                clasSnap = await getClasesByDateStartEnd(uid, dateToStr(start), dateToStr(end));
            }

            const almSnap = await getAlumnos(uid);
            const alms = almSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(a => a.activo !== false);
            setAlumnos(alms);
            const aMap = {};
            const cMap = {};
            alms.forEach((a, i) => { aMap[a.id] = a; cMap[a.id] = COLORS[i % COLORS.length]; });
            setAlumnoMap(aMap);
            setColorMap(cMap);

            const loadedClases = clasSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            setClases(loadedClases);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadData(); }, [currentDate, viewMode]);

    const changeDateRange = (delta) => {
        const d = new Date(currentDate);
        if (viewMode === 'diaria') d.setDate(d.getDate() + delta);
        if (viewMode === 'semanal') d.setDate(d.getDate() + (delta * 7));
        if (viewMode === 'mensual') d.setMonth(d.getMonth() + delta);
        setCurrentDate(d);
    };

    const markEstado = async (claseId, estado) => {
        await updateClaseById(uid, claseId, { estado });
        await loadData();
        setShowDetail(null);
    };

    const renderNavLabel = () => {
        if (viewMode === 'diaria') return formatDay(currentDate);
        if (viewMode === 'semanal') {
            const s = getStartOfWeek(currentDate);
            const e = new Date(s); e.setDate(e.getDate() + 6);
            return `${s.getDate()} ${s.toLocaleDateString('es-ES', { month: 'short' })} - ${e.getDate()} ${e.toLocaleDateString('es-ES', { month: 'short' })}`;
        }
        return currentDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    };

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">Horario</h1>
            </div>

            {/* View Toggle */}
            <div className="view-toggle seg-control">
                <button className={`seg-btn ${viewMode === 'diaria' ? 'active' : ''}`} onClick={() => setViewMode('diaria')}>Diaria</button>
                <button className={`seg-btn ${viewMode === 'semanal' ? 'active' : ''}`} onClick={() => setViewMode('semanal')}>Semanal</button>
                <button className={`seg-btn ${viewMode === 'mensual' ? 'active' : ''}`} onClick={() => setViewMode('mensual')}>Mensual</button>
            </div>

            {/* Navigator */}
            <div className="day-nav">
                <button className="day-nav-btn" onClick={() => changeDateRange(-1)}>◀</button>
                <div className="day-nav-label" style={{ textTransform: 'capitalize' }}>{renderNavLabel()}</div>
                <button className="day-nav-btn" onClick={() => changeDateRange(1)}>▶</button>
            </div>

            {loading ? (
                <div className="empty-state"><span>⏳</span><span className="empty-state-text">Cargando...</span></div>
            ) : (
                <>
                    {viewMode === 'diaria' && (
                        <div className="timeline">
                            {HOURS.map((hour) => {
                                const clasesInHour = clases.filter(c => {
                                    if (!c.horaInicio) return false;
                                    let [h, m] = c.horaInicio.split(':').map(x => parseInt(x, 10));
                                    return h === hour;
                                });
                                return (
                                    <div key={hour} className="timeline-row" style={{ position: 'relative', height: 64 }}>
                                        <span className="timeline-hour" style={{ top: 4 }}>
                                            {String(hour).padStart(2, '0')}:00
                                        </span>
                                        {clasesInHour.map(c => {
                                            const durH = (c.duracion_min || 60) / 60;
                                            const color = colorMap[c.alumnoId] || '#22c55e';
                                            const alumno = alumnoMap[c.alumnoId];
                                            let topOffset = 4;
                                            if (c.horaInicio) {
                                                let [_, m] = c.horaInicio.split(':').map(x => parseInt(x, 10));
                                                topOffset += (m / 60) * 64;
                                            }
                                            return (
                                                <div
                                                    key={c.id}
                                                    className="class-block"
                                                    style={{
                                                        background: color,
                                                        height: Math.max(durH * 64 - 4, 36),
                                                        top: topOffset,
                                                        opacity: c.estado === 'Cancelada' ? 0.4 : 1,
                                                    }}
                                                    onClick={() => setShowDetail(c)}
                                                >
                                                    <div className="class-block-name">
                                                        {alumno ? `${alumno.nombre} ${alumno.apellido}` : 'Alumno'}
                                                    </div>
                                                    <div className="class-block-time">
                                                        {c.horaInicio} · {c.duracion_min} min
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {viewMode === 'semanal' && (
                        <div className="weekly-container">
                            <div className="weekly-header">
                                <div className="weekly-day-col">Hora</div>
                                {Array.from({ length: 7 }).map((_, i) => {
                                    const d = new Date(getStartOfWeek(currentDate));
                                    d.setDate(d.getDate() + i);
                                    const isToday = dateToStr(d) === dateToStr(new Date());
                                    return (
                                        <div key={i} className={`weekly-day-col ${isToday ? 'today' : ''}`}>
                                            <div>{d.toLocaleDateString('es-ES', { weekday: 'short' }).toUpperCase()}</div>
                                            <div style={{ fontSize: '1rem', marginTop: 2 }}>{d.getDate()}</div>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="weekly-grid">
                                <div className="weekly-hour-col">
                                    {HOURS.map(hour => (
                                        <div key={hour} className="weekly-hour-label">{hour}:00</div>
                                    ))}
                                </div>
                                {Array.from({ length: 7 }).map((_, dayIndex) => {
                                    const d = new Date(getStartOfWeek(currentDate));
                                    d.setDate(d.getDate() + dayIndex);
                                    const dateString = dateToStr(d);
                                    const dayClases = clases.filter(c => c.fechaStr === dateString);

                                    return (
                                        <div key={dayIndex} className="weekly-col">
                                            {HOURS.map(hour => <div key={hour} className="weekly-row-line" />)}
                                            {dayClases.map(c => {
                                                if (!c.horaInicio) return null;
                                                let [h, m] = c.horaInicio.split(':').map(x => parseInt(x, 10));
                                                if (h < HOURS[0] || h > HOURS[HOURS.length - 1]) return null;

                                                const durH = (c.duracion_min || 60) / 60;
                                                const color = colorMap[c.alumnoId] || '#22c55e';
                                                const alumno = alumnoMap[c.alumnoId];
                                                const topOffset = ((h - HOURS[0]) * 60) + (m / 60) * 60;

                                                return (
                                                    <div
                                                        key={c.id}
                                                        className="weekly-class-block"
                                                        style={{
                                                            background: color,
                                                            height: Math.max(durH * 60 - 2, 24),
                                                            top: topOffset,
                                                            opacity: c.estado === 'Cancelada' ? 0.4 : 1,
                                                        }}
                                                        onClick={() => setShowDetail(c)}
                                                    >
                                                        <div className="weekly-class-name">
                                                            {alumno ? alumno.nombre : 'Al'}
                                                        </div>
                                                        <div>{c.horaInicio}</div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {viewMode === 'mensual' && (
                        <div className="monthly-grid">
                            {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(d => (
                                <div key={d} className="monthly-header-day">{d}</div>
                            ))}
                            {(() => {
                                const start = getStartOfMonth(currentDate);
                                const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
                                let firstDay = start.getDay() === 0 ? 6 : start.getDay() - 1; // 0=Lunes
                                const daysInMonth = end.getDate();
                                const cells = [];

                                // Empty prev month cells
                                for (let i = 0; i < firstDay; i++) {
                                    cells.push(<div key={`empty-${i}`} className="monthly-cell other-month" />);
                                }

                                // Days
                                const todayStrLocal = dateToStr(new Date());
                                for (let i = 1; i <= daysInMonth; i++) {
                                    const d = new Date(start.getFullYear(), start.getMonth(), i);
                                    const dateString = dateToStr(d);
                                    const isToday = dateString === todayStrLocal;
                                    const dayClases = clases.filter(c => c.fechaStr === dateString);

                                    cells.push(
                                        <div key={i} className={`monthly-cell ${isToday ? 'today' : ''}`}>
                                            <div className="monthly-day-number">{i}</div>
                                            <div className="monthly-events">
                                                {dayClases.map(c => {
                                                    const alumno = alumnoMap[c.alumnoId];
                                                    const color = colorMap[c.alumnoId] || '#22c55e';
                                                    return (
                                                        <div
                                                            key={c.id}
                                                            className="monthly-event-dot"
                                                            style={{ borderColor: color, opacity: c.estado === 'Cancelada' ? 0.4 : 1 }}
                                                            onClick={() => setShowDetail(c)}
                                                        >
                                                            {c.horaInicio} {alumno ? alumno.nombre : ''}
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    );
                                }

                                // Empty next month cells to fill grid row
                                const totalCells = cells.length;
                                const remainder = totalCells % 7;
                                if (remainder !== 0) {
                                    for (let i = 0; i < 7 - remainder; i++) {
                                        cells.push(<div key={`empty-end-${i}`} className="monthly-cell other-month" />);
                                    }
                                }

                                return cells;
                            })()}
                        </div>
                    )}

                </>
            )}

            {/* FAB */}
            <button className="fab" onClick={() => setShowModal(true)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
            </button>

            {/* Nueva Clase Modal */}
            {showModal && (
                <NuevaClaseModal
                    uid={uid}
                    defaultDate={dateToStr(currentDate)}
                    onClose={() => setShowModal(false)}
                    onSaved={() => { setShowModal(false); loadData(); }}
                />
            )}

            {/* Detail Modal */}
            {showDetail && (
                <div className="overlay" onClick={() => setShowDetail(null)}>
                    <div className="bottom-sheet" onClick={e => e.stopPropagation()}>
                        <div className="sheet-handle" />
                        <div className="sheet-title">
                            {alumnoMap[showDetail.alumnoId]
                                ? `${alumnoMap[showDetail.alumnoId].nombre} ${alumnoMap[showDetail.alumnoId].apellido}`
                                : 'Clase'}
                        </div>
                        <p className="text-secondary">{showDetail.fechaStr} · {showDetail.horaInicio} · {showDetail.duracion_min} min</p>
                        {showDetail.cancha && <p className="text-secondary mt-4">Cancha: {showDetail.cancha}</p>}
                        {showDetail.notas && <p className="text-secondary mt-4">📝 {showDetail.notas}</p>}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 20 }}>
                            <button className="btn btn-primary btn-full"
                                onClick={() => markEstado(showDetail.id, 'Completada')}>✅ Marcar como Completada</button>
                            <button className="btn btn-outline btn-full"
                                onClick={() => markEstado(showDetail.id, 'Cancelada')}>❌ Cancelar clase</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function NuevaClaseModal({ uid, defaultDate, onClose, onSaved }) {
    const [alumnos, setAlumnos] = useState([]);
    const [alumnoId, setAlumnoId] = useState('');
    const [fecha, setFecha] = useState(defaultDate);
    const [hora, setHora] = useState('09:00');
    const [duracion, setDuracion] = useState(60);
    const [cancha, setCancha] = useState('Cancha 1');
    const [tarifa, setTarifa] = useState('');
    const [notas, setNotas] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        getAlumnos(uid).then(snap => {
            setAlumnos(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(a => a.activo !== false));
        });
    }, []);

    const handleSave = async () => {
        if (!alumnoId || !fecha || !hora || !tarifa) return;
        setSaving(true);
        try {
            await addClase(uid, {
                alumnoId, fechaStr: fecha, horaInicio: hora,
                duracion_min: duracion, cancha, notas, tarifa: Number(tarifa),
                estado: 'Pendiente', cobrada: false,
            });
            onSaved();
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="overlay" onClick={onClose}>
            <div className="bottom-sheet" onClick={e => e.stopPropagation()}>
                <div className="sheet-handle" />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <div className="sheet-title" style={{ margin: 0 }}>Nueva Clase</div>
                    <button
                        onClick={onClose}
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 8 }}
                    >
                        ✕ Cancelar
                    </button>
                </div>

                <div className="form-group">
                    <label className="form-label">Alumno</label>
                    <select className="form-select" value={alumnoId} onChange={e => setAlumnoId(e.target.value)}>
                        <option value="">Seleccionar alumno...</option>
                        {alumnos.map(a => <option key={a.id} value={a.id}>{a.nombre} {a.apellido}</option>)}
                    </select>
                </div>

                <div className="form-group">
                    <label className="form-label">📅 Fecha</label>
                    <div style={{ position: 'relative' }}>
                        <input
                            type="date"
                            className="form-input"
                            value={fecha}
                            onChange={e => setFecha(e.target.value)}
                            style={{ paddingLeft: 44, colorScheme: 'dark', cursor: 'pointer' }}
                        />
                        <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 20, pointerEvents: 'none' }}>📅</span>
                    </div>
                </div>

                <div className="form-group">
                    <label className="form-label">🕒 Hora inicio</label>
                    <div style={{ position: 'relative' }}>
                        <input
                            type="time"
                            className="form-input"
                            value={hora}
                            step="3600"
                            onChange={e => {
                                // Force minutes to be 00
                                const [h] = e.target.value.split(':');
                                if (h) setHora(`${h}:00`);
                            }}
                            style={{ paddingLeft: 44, colorScheme: 'dark', cursor: 'pointer' }}
                        />
                        <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 20, pointerEvents: 'none' }}>🕒</span>
                    </div>
                </div>

                <div className="form-group">
                    <label className="form-label">Duración</label>
                    <div className="seg-control">
                        {[60, 120, 180].map(d => (
                            <button key={d} className={`seg-btn ${duracion === d ? 'active' : ''}`} onClick={() => setDuracion(d)}>
                                {d / 60} {d === 60 ? 'Hora' : 'Horas'}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="form-group">
                    <label className="form-label">Cancha</label>
                    <div className="seg-control">
                        {['1', '2', '3', '4', '5'].map(num => {
                            const cName = `Cancha ${num}`;
                            return (
                                <button key={cName} className={`seg-btn ${cancha === cName ? 'active' : ''}`} onClick={() => setCancha(cName)}>
                                    {num}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="form-group">
                    <label className="form-label">Tarifa de la clase (USD)</label>
                    <div style={{ position: 'relative' }}>
                        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--green)', fontWeight: 700 }}>$</span>
                        <input className="form-input" type="number" value={tarifa} onChange={e => setTarifa(e.target.value)} placeholder="0.00" style={{ paddingLeft: 28 }} />
                    </div>
                </div>

                <div className="form-group">
                    <label className="form-label">Notas (opcional)</label>
                    <textarea className="form-textarea" value={notas} onChange={e => setNotas(e.target.value)} placeholder="Ejercicios, observaciones..." />
                </div>

                <button className="btn btn-primary btn-full" onClick={handleSave} disabled={saving || !alumnoId || !tarifa}>
                    {saving ? 'Guardando...' : 'Guardar Clase'}
                </button>
            </div>
        </div>
    );
}
