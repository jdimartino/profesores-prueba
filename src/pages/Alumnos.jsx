import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getAlumnos, addAlumno, updateAlumno, deleteAlumno } from '../firebase/db';

const NIVELES = ['Principiante', 'Intermedio', 'Avanzado', 'Competición'];
const COLORS = ['#22c55e', '#3b82f6', '#f97316', '#a855f7', '#14b8a6', '#f43f5e', '#eab308'];

function getInitials(nombre = '', apellido = '') {
    return `${nombre[0] || ''}${apellido[0] || ''}`.toUpperCase();
}

function nivelBadge(nivel) {
    const map = {
        'Principiante': 'badge-info',
        'Intermedio': 'badge-warning',
        'Avanzado': 'badge-green',
        'Competición': 'badge-danger',
    };
    return map[nivel] || 'badge-muted';
}

export default function Alumnos() {
    const { user } = useAuth();
    const uid = user.uid;
    const [alumnos, setAlumnos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editAlumno, setEditAlumno] = useState(null);

    const load = async () => {
        setLoading(true);
        try {
            const snap = await getAlumnos(uid);
            setAlumnos(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(a => a.activo !== false));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const handleEdit = (a) => { setEditAlumno(a); setShowModal(true); };
    const handleNew = () => { setEditAlumno(null); setShowModal(true); };
    const handleSaved = () => { setShowModal(false); setEditAlumno(null); load(); };

    const handleDelete = async (a) => {
        if (!window.confirm(`¿Eliminar a ${a.nombre}?`)) return;
        await deleteAlumno(uid, a.id);
        load();
    };

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">Alumnos</h1>
                <span className="badge badge-muted">{alumnos.length} activos</span>
            </div>

            {loading ? (
                <div className="empty-state"><span>⏳</span><span className="empty-state-text">Cargando...</span></div>
            ) : alumnos.length === 0 ? (
                <div className="empty-state">
                    <span className="empty-state-icon">👤</span>
                    <span className="empty-state-text">Aún no tienes alumnos. ¡Añade el primero!</span>
                </div>
            ) : (
                alumnos.map((a, i) => (
                    <div key={a.id} className="list-item" onClick={() => handleEdit(a)}>
                        <div className="avatar" style={{ background: COLORS[i % COLORS.length] }}>
                            {getInitials(a.nombre, a.apellido)}
                        </div>
                        <div className="list-item-content">
                            <div className="list-item-title">{a.nombre} {a.apellido}</div>
                            <div className="list-item-sub">
                                <span className={`badge ${nivelBadge(a.nivel)}`}>{a.nivel}</span>
                            </div>
                        </div>
                        <button
                            className="btn btn-danger btn-sm"
                            onClick={e => { e.stopPropagation(); handleDelete(a); }}
                        >
                            🗑
                        </button>
                    </div>
                ))
            )}

            <button className="fab" onClick={handleNew}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
            </button>

            {showModal && (
                <AlumnoModal
                    uid={uid}
                    initial={editAlumno}
                    onClose={() => { setShowModal(false); setEditAlumno(null); }}
                    onSaved={handleSaved}
                />
            )}
        </div>
    );
}

function AlumnoModal({ uid, initial, onClose, onSaved }) {
    const [nombre, setNombre] = useState(initial?.nombre || '');
    const [apellido, setApellido] = useState(initial?.apellido || '');
    const [telefono, setTelefono] = useState(initial?.telefono || '');
    const [email, setEmail] = useState(initial?.email || '');
    const [nivel, setNivel] = useState(initial?.nivel || 'Principiante');
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        if (!nombre || !apellido) return;
        setSaving(true);
        const data = { nombre, apellido, telefono, email, nivel };
        try {
            if (initial) await updateAlumno(uid, initial.id, data);
            else await addAlumno(uid, data);
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
                    <div className="sheet-title" style={{ margin: 0 }}>{initial ? 'Editar Alumno' : 'Nuevo Alumno'}</div>
                    <button
                        onClick={onClose}
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 8 }}
                    >
                        ✕ Cancelar
                    </button>
                </div>

                <div className="form-group">
                    <label className="form-label">Nombre</label>
                    <input className="form-input" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Juan" />
                </div>
                <div className="form-group">
                    <label className="form-label">Apellido</label>
                    <input className="form-input" value={apellido} onChange={e => setApellido(e.target.value)} placeholder="García" />
                </div>
                <div className="form-group">
                    <label className="form-label">Teléfono (WhatsApp)</label>
                    <input className="form-input" type="tel" value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="+58412..." />
                </div>
                <div className="form-group">
                    <label className="form-label">Email (opcional)</label>
                    <input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="juan@email.com" />
                </div>
                <div className="form-group">
                    <label className="form-label">Nivel</label>
                    <div className="seg-control">
                        {NIVELES.map(n => (
                            <button key={n} className={`seg-btn ${nivel === n ? 'active' : ''}`} onClick={() => setNivel(n)}>
                                {n}
                            </button>
                        ))}
                    </div>
                </div>

                <button className="btn btn-primary btn-full" onClick={handleSave} disabled={saving || !nombre || !apellido}>
                    {saving ? 'Guardando...' : initial ? 'Guardar Cambios' : 'Añadir Alumno'}
                </button>
            </div>
        </div>
    );
}
