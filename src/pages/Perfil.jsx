import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { signOut } from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';

export default function Perfil() {
    const { user } = useAuth();
    const uid = user.uid;
    const [nombre, setNombre] = useState('');
    const [whatsapp, setWhatsapp] = useState('');
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        const load = async () => {
            try {
                const snap = await getDoc(doc(db, 'profesores', uid, 'perfil', 'datos'));
                if (snap.exists()) {
                    const d = snap.data();
                    setNombre(d.nombre || '');
                    setWhatsapp(d.whatsapp || '');
                }
            } catch { }
        };
        load();
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            await setDoc(doc(db, 'profesores', uid, 'perfil', 'datos'), {
                nombre,
                whatsapp,
                email: user.email,
            }, { merge: true });
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } finally {
            setSaving(false);
        }
    };

    const handleLogout = async () => {
        if (window.confirm('¿Cerrar sesión?')) {
            await signOut(auth);
        }
    };

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">Mi Perfil</h1>
            </div>

            {/* User info */}
            <div className="card mb-16" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{
                    width: 52, height: 52, borderRadius: '50%',
                    background: 'var(--green)', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: '1.3rem', color: '#000', fontWeight: 700, flexShrink: 0
                }}>
                    🎾
                </div>
                <div>
                    <div style={{ fontWeight: 700 }}>{nombre || 'Profesor'}</div>
                    <div className="text-secondary text-sm">{user.email}</div>
                </div>
            </div>

            <div className="card mb-16">
                <div className="form-group">
                    <label className="form-label">Tu nombre</label>
                    <input
                        className="form-input"
                        value={nombre}
                        onChange={e => setNombre(e.target.value)}
                        placeholder="Ej: Carlos García"
                    />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Número de WhatsApp</label>
                    <input
                        className="form-input"
                        value={whatsapp}
                        onChange={e => setWhatsapp(e.target.value)}
                        placeholder="Ej: +58 412 1234567"
                    />
                    <span className="text-xs text-muted mt-4">Este número se usará para comunicaciones oficiales</span>
                </div>
            </div>

            <button
                className="btn btn-primary btn-full mb-16"
                onClick={handleSave}
                disabled={saving}
            >
                {saving ? 'Guardando...' : saved ? '✅ Guardado!' : 'Guardar Cambios'}
            </button>

            <button className="btn btn-danger btn-full" onClick={handleLogout}>
                🚪 Cerrar Sesión
            </button>

            <div style={{ textAlign: 'center', marginTop: 32 }}>
                <span className="text-xs text-muted">TenisProfe v1.0 🎾</span>
            </div>
        </div>
    );
}
