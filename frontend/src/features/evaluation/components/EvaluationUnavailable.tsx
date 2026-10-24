import { Link } from 'react-router-dom';
import Alert from '../../../components/ui/Alert';

/** Mensaje cuando el navegador no tiene el token de la evaluación (o no existe). */
const EvaluationUnavailable = ({ error = false }: { error?: boolean }) => (
    <div className="mx-auto max-w-xl space-y-4">
        <Alert
            type={error ? 'error' : 'warning'}
            title={error ? 'No se pudo cargar la evaluación' : 'Esta evaluación no está disponible en este navegador'}
            message={error
                ? 'Revise su conexión e intente de nuevo.'
                : 'Las evaluaciones se pueden retomar solo desde el navegador donde se crearon. Puede empezar una nueva.'}
        />
        <Link to="/" className="text-sm font-semibold text-[var(--color-primary)] hover:underline">Volver al inicio</Link>
    </div>
);

export default EvaluationUnavailable;
