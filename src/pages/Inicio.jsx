import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getClasesByDate, getAlumnos } from '../firebase/db';
import { getDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';

const COLORS = ['#22c55e', '#3b82f6', '#f97316', '#a855f7', '#14b8a6', '#f43f5e', '#eab308'];

function todayStr() {
    return new Date().toISOString().split('T')[0];
}

function getMesActual() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export default function Inicio() {
    const { user } = useAuth();
    const uid = user.uid;
    const [stats, setStats] = useState({ alumnos: 0, clasesHoy: 0, cobrosPend: 0, ingresosUSD: 0 });
    const [clasesHoy, setClasesHoy] = useState([]);
    const [alumnoMap, setAlumnoMap] = useState({});
    const [colorMap, setColorMap] = useState({});
    const [loading, setLoading] = useState(true);
    const [nombre, setNombre] = useState('Profe');

    useEffect(() => {
        const load = async () => {
            try {
                // Get perfil for name
                const perfilDoc = await getDoc(doc(db, 'profesores', uid, 'perfil', 'datos'));
                if (perfilDoc.exists() && perfilDoc.data().nombre) {
                    setNombre(perfilDoc.data().nombre);
                }
                const [almSnap, clasHoySnap] = await Promise.all([
                    getAlumnos(uid),
                    getClasesByDate(uid, todayStr()),
                ]);

                const alms = almSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(a => a.activo !== false);
                const aMap = {};
                const cMap = {};
                alms.forEach((a, i) => { aMap[a.id] = a; cMap[a.id] = COLORS[i % COLORS.length]; });
                setAlumnoMap(aMap);
                setColorMap(cMap);

                const clasesHoyData = clasHoySnap.docs.map(d => ({ id: d.id, ...d.data() }));
                setClasesHoy(clasesHoyData);

                // Pending cobros: classes completed + not cobradas
                const { getClasesPendientesDeCobro } = await import('../firebase/db');
                const pendSnap = await getClasesPendientesDeCobro(uid);
                const cobrosSnap = await import('../firebase/db').then(m => m.getCobros(uid));
                const ingresos = cobrosSnap.docs.reduce((s, d) => s + (d.data().importe_usd || 0), 0);

                // Unique pending alumnos
                const pendAlumnos = new Set(pendSnap.docs.map(d => d.data().alumnoId));

                setStats({
                    alumnos: alms.length,
                    clasesHoy: clasesHoyData.length,
                    cobrosPend: pendAlumnos.size,
                    ingresosUSD: ingresos,
                });
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const greeting = () => {
        const h = new Date().getHours();
        if (h < 12) return 'Buenos días';
        if (h < 18) return 'Buenas tardes';
        return 'Buenas noches';
    };

    const hoy = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

    return (
        <div>
            <div style={{ marginBottom: 20 }}>
                <h1 style={{ fontSize: '1.4rem', fontWeight: 800 }}>{greeting()}, {nombre}! 👋</h1>
                <p className="text-secondary text-sm" style={{ marginTop: 4, textTransform: 'capitalize' }}>{hoy}</p>
            </div>

            {loading ? (
                <div className="empty-state"><span>⏳</span></div>
            ) : (
                <>
                    <div className="stat-grid">
                        <div className="stat-card">
                            <div className="stat-icon">👥</div>
                            <div className="stat-label">Alumnos</div>
                            <div className="stat-value">{stats.alumnos}</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon">🎾</div>
                            <div className="stat-label">Clases Hoy</div>
                            <div className="stat-value">{stats.clasesHoy}</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon">💰</div>
                            <div className="stat-label">Cobros Pend.</div>
                            <div className="stat-value">{stats.cobrosPend}</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon">📈</div>
                            <div className="stat-label">Ingresos</div>
                            <div className="stat-value" style={{ fontSize: '1.2rem' }}>${stats.ingresosUSD.toFixed(0)}</div>
                        </div>
                    </div>

                    <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 12 }}>Clases de Hoy</h2>

                    {clasesHoy.length === 0 ? (
                        <div className="empty-state" style={{ padding: '24px' }}>
                            <span>📅</span>
                            <span className="text-secondary text-sm">Sin clases programadas hoy</span>
                        </div>
                    ) : (
                        clasesHoy.map(c => {
                            const a = alumnoMap[c.alumnoId];
                            const color = colorMap[c.alumnoId] || '#22c55e';
                            return (
                                <div key={c.id} className="list-item">
                                    <div style={{
                                        width: 4, height: 48, borderRadius: 2,
                                        background: color, flexShrink: 0
                                    }} />
                                    <div className="list-item-content">
                                        <div className="list-item-title">
                                            {a ? `${a.nombre} ${a.apellido}` : 'Alumno'}
                                        </div>
                                        <div className="list-item-sub">
                                            {c.horaInicio} · {c.duracion_min} min · {c.cancha}
                                        </div>
                                    </div>
                                    <span className={`badge ${c.estado === 'Completada' ? 'badge-green' :
                                            c.estado === 'Cancelada' ? 'badge-danger' : 'badge-muted'
                                        }`}>{c.estado}</span>
                                </div>
                            );
                        })
                    )}
                </>
            )}
        </div>
    );
}
