import { useEffect, useState } from 'react';
import { getAlumnos, addClase, updateClaseById } from '../firebase/db';

export default function NuevaClaseModal({ uid, defaultDate, onClose, onSaved, initialData }) {
    const [alumnos, setAlumnos] = useState([]);
    const [alumnoId, setAlumnoId] = useState(initialData?.alumnoId || '');
    const [fecha, setFecha] = useState(initialData?.fechaStr || defaultDate);
    const [hora, setHora] = useState(initialData?.horaInicio || '07:00');
    const [duracion, setDuracion] = useState(initialData?.duracion_min || 60);
    const [cancha, setCancha] = useState(initialData?.cancha || 'Cancha 1');
    const [moneda, setMoneda] = useState(initialData?.moneda || 'USD');
    const [tarifa, setTarifa] = useState(initialData?.tarifa !== undefined ? String(initialData.tarifa) : '');
    const [tasas, setTasas] = useState({ USD: 0, EUR: 0 });
    const [notas, setNotas] = useState(initialData?.notas || '');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        getAlumnos(uid).then(snap => {
            setAlumnos(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(a => a.activo !== false));
        });
        
        // Fetch official exchange rates
        Promise.all([
            fetch('https://ve.dolarapi.com/v1/dolares/oficial').then(r => r.json()).catch(() => null),
            fetch('https://ve.dolarapi.com/v1/euros/oficial').then(r => r.json()).catch(() => null)
        ]).then(([usdData, eurData]) => {
            setTasas({
                USD: usdData?.promedio || 0,
                EUR: eurData?.promedio || 0
            });
        });
    }, [uid]);

    const handleSave = async () => {
        if (!alumnoId || !fecha || !hora || !tarifa) return;
        setSaving(true);
        try {
            const data = {
                alumnoId, fechaStr: fecha, horaInicio: hora,
                duracion_min: duracion, cancha, notas, tarifa: Number(tarifa),
                moneda
            };
            if (initialData?.id) {
                await updateClaseById(uid, initialData.id, data);
            } else {
                await addClase(uid, {
                    ...data, estado: 'Pendiente', cobrada: false,
                });
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
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <div className="sheet-title" style={{ margin: 0 }}>{initialData ? 'Editar Clase' : 'Nueva Clase'}</div>
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
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 4 }}>
                        <label className="form-label" style={{ margin: 0 }}>Tarifa de la clase</label>
                        {tarifa && tasas[moneda] > 0 && (
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                ≈ Bs {(Number(tarifa) * tasas[moneda]).toLocaleString('es-VE')}
                            </span>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <select 
                            className="form-select" 
                            style={{ width: '80px', padding: '0 12px' }}
                            value={moneda} 
                            onChange={e => setMoneda(e.target.value)}
                        >
                            <option value="USD">USD</option>
                            <option value="EUR">EUR</option>
                        </select>
                        <div style={{ position: 'relative', flex: 1 }}>
                            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--green)', fontWeight: 700 }}>
                                {moneda === 'USD' ? '$' : '€'}
                            </span>
                            <input className="form-input" type="number" value={tarifa} onChange={e => setTarifa(e.target.value)} placeholder="0.00" style={{ paddingLeft: 28 }} />
                        </div>
                    </div>
                </div>

                <div className="form-group">
                    <label className="form-label">Notas (opcional)</label>
                    <textarea className="form-textarea" value={notas} onChange={e => setNotas(e.target.value)} placeholder="Ejercicios, observaciones..." />
                </div>

                <button className="btn btn-primary btn-full" onClick={handleSave} disabled={saving || !alumnoId || !tarifa}>
                    {saving ? 'Guardando...' : (initialData ? 'Actualizar Clase' : 'Guardar Clase')}
                </button>
            </div>
        </div>
    );
}
