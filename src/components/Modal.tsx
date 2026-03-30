import { X } from 'lucide-react';
import type { ReactNode } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}

export default function Modal({ open, onClose, title, children, wide }: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div
        className={`bg-white rounded-xl shadow-xl border border-[#E3E8EE] max-h-[90vh] overflow-y-auto ${wide ? 'w-[700px]' : 'w-[500px]'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-[#E3E8EE]">
          <h2 className="text-lg font-semibold text-[#0A2540]">{title}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-[#F6F9FC] text-[#596880]">
            <X size={18} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
