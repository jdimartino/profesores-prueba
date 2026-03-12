import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getAlumnos, addAlumno, updateAlumno, deleteAlumno } from '../firebase/db';

const NIVELES = ['Principiante', '7ma', '6ta', '5ta', '4ta'];
const COLORS = ['#22c55e', '#3b82f6', '#f97316', '#a855f7', '#14b8a6', '#f43f5e', '#eab308'];

function getInitials(nombre = '', apellido = '') {
    return `${nombre[0] || ''}${apellido[0] || ''}`.toUpperCase();
}

function nivelBadge(nivel) {
    const map = {
        'Principiante': 'badge-info',
        '7ma': 'badge-warning',
        '6ta': 'badge-green',
        '5ta': 'badge-danger',
        '4ta': 'badge-purple',
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
                        <div className="avatar" style={{ background: COLORS[i % COLORS.length], backgroundImage: a.photoURL ? `url(${a.photoURL})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center', color: a.photoURL ? 'transparent' : undefined }}>
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
    const [photoFile, setPhotoFile] = useState(null);
    const [photoPreview, setPhotoPreview] = useState(initial?.photoURL || null);

    const handlePhotoChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    // Resize to max 150x150 for Base64 storage
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 150;
                    const MAX_HEIGHT = 150;
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > MAX_WIDTH) {
                            height *= MAX_WIDTH / width;
                            width = MAX_WIDTH;
                        }
                    } else {
                        if (height > MAX_HEIGHT) {
                            width *= MAX_HEIGHT / height;
                            height = MAX_HEIGHT;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    // Get base64 string, lower quality to save space
                    const base64String = canvas.toDataURL('image/jpeg', 0.7);
                    setPhotoFile(base64String);
                    setPhotoPreview(base64String);
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSave = async () => {
        if (!nombre || !apellido) return;
        setSaving(true);
        try {
            let photoURL = initial?.photoURL || null;
            if (photoFile) {
                photoURL = typeof photoFile === 'string' ? photoFile : null; 
            }
            
            const data = { nombre, apellido, telefono, email, nivel };
            if (photoURL) data.photoURL = photoURL;
            
            if (initial) await updateAlumno(uid, initial.id, data);
            else await addAlumno(uid, data);
            onSaved();
        } catch (error) {
            console.error("Error saving alumno: ", error);
            alert("Error al guardar. Intenta de nuevo.");
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

                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '16px' }}>
                    <div 
                        style={{
                            width: 80, height: 80, borderRadius: '50%', background: '#eee', 
                            backgroundImage: photoPreview ? `url(${photoPreview})` : 'none', 
                            backgroundSize: 'cover', backgroundPosition: 'center',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', border: '2px solid #ddd', overflow: 'hidden', position: 'relative'
                        }}
                        onClick={() => document.getElementById('photoInput').click()}
                    >
                        {!photoPreview && <span style={{ fontSize: '24px', color: '#999' }}>📷</span>}
                    </div>
                    <input id="photoInput" type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoChange} />
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px', cursor: 'pointer' }} onClick={() => document.getElementById('photoInput').click()}>Toca para cambiar foto</span>
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
