import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AlertTriangle, ImageIcon, X, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

export type Condition = 'otimo' | 'bom' | 'ruim' | 'pessimo';

export const CATEGORIES = ['Veículo', 'Equipamento', 'Imóvel', 'Móvel', 'Implemento', 'Outro'] as const;

export interface PatrimonyFormItem {
  id: string;
  name: string;
  patrimony_number: string;
  patrimony_number_state?: string | null;
  description: string | null;
  value: number | null;
  category: string | null;
  acquisition_date: string | null;
  written_off: boolean;
  condition: Condition | null;
  image_url: string | null;
  image_url_2?: string | null;
  image_url_3?: string | null;
  // Operational (shown only on create)
  location?: string | null;
  responsible_name?: string | null;
  responsible_phone?: string | null;
}

export interface PatrimonyFormPayload {
  name: string;
  patrimony_number: string;
  patrimony_number_state: string | null;
  description: string | null;
  value: number | null;
  category: string | null;
  acquisition_date: string | null;
  written_off: boolean;
  condition: Condition | null;
  image_url: string | null;
  image_url_2: string | null;
  image_url_3: string | null;
  // Only present for create
  location?: string | null;
  responsible_name?: string | null;
  responsible_phone?: string | null;
}

interface PatrimonyFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: PatrimonyFormItem | null;
  /** Called with final payload (image URLs already resolved) */
  onSubmit: (data: PatrimonyFormPayload) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseCurrencyInput(raw: string): number | null {
  const cleaned = raw.replace(/[^\d,\.]/g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

async function uploadPatrimonyImage(file: File, itemId: string, slot: number): Promise<string | null> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
  const path = `${itemId}/photo-${slot}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from('patrimony-images')
    .upload(path, file, { upsert: true });
  if (error) {
    console.error('[PatrimonyForm] Image upload error:', error);
    return null;
  }
  const { data } = supabase.storage.from('patrimony-images').getPublicUrl(path);
  return data?.publicUrl ?? null;
}

// ─── ImageSlot ────────────────────────────────────────────────────────────────

interface ImageSlotProps {
  slot: number;
  file: File | null;
  preview: string | null;
  existingUrl: string | null;
  onSelect: (slot: number, file: File) => void;
  onClear: (slot: number) => void;
}

function ImageSlot({ slot, file: _file, preview, existingUrl, onSelect, onClear }: ImageSlotProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const displaySrc = preview ?? existingUrl;

  return (
    <div className="relative">
      {displaySrc ? (
        <div className="relative w-full h-28 rounded-lg overflow-hidden border bg-muted">
          <img src={displaySrc} alt={`Foto ${slot}`} className="w-full h-full object-cover" />
          <button
            type="button"
            onClick={() => onClear(slot)}
            className="absolute top-1.5 right-1.5 bg-black/60 hover:bg-black/80 text-white rounded-full p-1 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full h-28 rounded-lg border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 flex flex-col items-center justify-center gap-1.5 text-muted-foreground hover:text-primary transition-colors"
        >
          <Plus className="h-5 w-5" />
          <ImageIcon className="h-5 w-5 opacity-50" />
          <span className="text-xs">Foto {slot}</span>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onSelect(slot, f);
          e.target.value = '';
        }}
      />
    </div>
  );
}

// ─── PatrimonyForm ────────────────────────────────────────────────────────────

export function PatrimonyForm({ open, onOpenChange, item, onSubmit }: PatrimonyFormProps) {
  const isEditing = !!item;

  // Static fields
  const [name, setName]                           = useState('');
  const [patrimonyNumber, setPatrimonyNumber]     = useState('');
  const [patrimonyNumberState, setPatrimonyNumberState] = useState('');
  const [description, setDescription]             = useState('');
  const [value, setValue]                         = useState('');
  const [category, setCategory]                   = useState('');
  const [acquisitionDate, setAcquisitionDate]     = useState('');
  const [writtenOff, setWrittenOff]               = useState(false);
  const [condition, setCondition]                 = useState<Condition | ''>('');

  // Create-only: initial operational state (seeds first transfer)
  const [location, setLocation]                   = useState('');
  const [responsibleName, setResponsibleName]     = useState('');
  const [responsiblePhone, setResponsiblePhone]   = useState('');

  // Images: 3 slots — [existingUrl, previewUrl, file]
  const [imgSlots, setImgSlots] = useState<Array<{ file: File | null; preview: string | null; existingUrl: string | null }>>([
    { file: null, preview: null, existingUrl: null },
    { file: null, preview: null, existingUrl: null },
    { file: null, preview: null, existingUrl: null },
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Populate on open ───────────────────────────────────────────────────────

  useEffect(() => {
    if (open) {
      if (item) {
        setName(item.name);
        setPatrimonyNumber(item.patrimony_number);
        setPatrimonyNumberState(item.patrimony_number_state ?? '');
        setDescription(item.description ?? '');
        setValue(
          item.value != null
            ? item.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : '',
        );
        setCategory(item.category ?? '');
        setAcquisitionDate(item.acquisition_date ?? '');
        setWrittenOff(item.written_off ?? false);
        setCondition((item.condition ?? '') as Condition | '');
        setImgSlots([
          { file: null, preview: null, existingUrl: item.image_url ?? null },
          { file: null, preview: null, existingUrl: item.image_url_2 ?? null },
          { file: null, preview: null, existingUrl: item.image_url_3 ?? null },
        ]);
        // Edit mode: operational fields not shown
        setLocation('');
        setResponsibleName('');
        setResponsiblePhone('');
      } else {
        setName(''); setPatrimonyNumber(''); setPatrimonyNumberState('');
        setDescription(''); setValue(''); setCategory('');
        setAcquisitionDate(''); setWrittenOff(false); setCondition('');
        setLocation(''); setResponsibleName(''); setResponsiblePhone('');
        setImgSlots([
          { file: null, preview: null, existingUrl: null },
          { file: null, preview: null, existingUrl: null },
          { file: null, preview: null, existingUrl: null },
        ]);
      }
    }
  }, [open, item]);

  // ── Image handlers ─────────────────────────────────────────────────────────

  const handleImageSelect = useCallback((slot: number, file: File) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      setImgSlots((prev) => prev.map((s, i) =>
        i === slot - 1 ? { ...s, file, preview: ev.target?.result as string } : s,
      ));
    };
    reader.readAsDataURL(file);
  }, []);

  const handleImageClear = useCallback((slot: number) => {
    setImgSlots((prev) => prev.map((s, i) =>
      i === slot - 1 ? { file: null, preview: null, existingUrl: null } : s,
    ));
  }, []);

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const uploadId = item?.id ?? crypto.randomUUID();
      const resolvedUrls: (string | null)[] = [];

      for (let i = 0; i < 3; i++) {
        const slot = imgSlots[i];
        if (slot.file) {
          const url = await uploadPatrimonyImage(slot.file, uploadId, i + 1);
          resolvedUrls.push(url);
        } else {
          resolvedUrls.push(slot.existingUrl);
        }
      }

      const payload: PatrimonyFormPayload = {
        name,
        patrimony_number: patrimonyNumber,
        patrimony_number_state: patrimonyNumberState.trim() || null,
        description: description.trim() || null,
        value: parseCurrencyInput(value),
        category: category || null,
        acquisition_date: acquisitionDate || null,
        written_off: writtenOff,
        condition: (condition || null) as Condition | null,
        image_url: resolvedUrls[0],
        image_url_2: resolvedUrls[1],
        image_url_3: resolvedUrls[2],
      };

      // CREATE-only: include initial operational state
      if (!isEditing) {
        payload.location = location.trim() || null;
        payload.responsible_name = responsibleName.trim() || null;
        payload.responsible_phone = responsiblePhone.trim() || null;
      }

      onSubmit(payload);
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Bem' : 'Novo Bem'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* ── Photos (3 slots) ── */}
          <div className="space-y-2">
            <Label>Fotos (até 3)</Label>
            <div className="grid grid-cols-3 gap-2">
              {([1, 2, 3] as const).map((slot) => (
                <ImageSlot
                  key={slot}
                  slot={slot}
                  file={imgSlots[slot - 1].file}
                  preview={imgSlots[slot - 1].preview}
                  existingUrl={imgSlots[slot - 1].existingUrl}
                  onSelect={handleImageSelect}
                  onClear={handleImageClear}
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground">JPG, PNG, WebP — máx 5 MB por foto</p>
          </div>

          {/* ── Name ── */}
          <div className="space-y-2">
            <Label htmlFor="pat-name">Nome do Bem *</Label>
            <Input
              id="pat-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Veículo Hilux"
              required
            />
          </div>

          {/* ── Patrimony Numbers ── */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="pat-number-mun">Nº Patrimônio Municipal *</Label>
              <Input
                id="pat-number-mun"
                value={patrimonyNumber}
                onChange={(e) => setPatrimonyNumber(e.target.value)}
                placeholder="PAT-001"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pat-number-state">Nº Patrimônio Estadual</Label>
              <Input
                id="pat-number-state"
                value={patrimonyNumberState}
                onChange={(e) => setPatrimonyNumberState(e.target.value)}
                placeholder="Opcional"
              />
            </div>
          </div>

          {/* ── Category & Condition (condition only on CREATE) ── */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="pat-category">Categoria</Label>
              <select
                id="pat-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="">Selecionar</option>
                {CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>

            {!isEditing && (
              <div className="space-y-2">
                <Label htmlFor="pat-condition">Estado de Conservação</Label>
                <select
                  id="pat-condition"
                  value={condition}
                  onChange={(e) => {
                    const val = e.target.value as Condition | '';
                    setCondition(val);
                    if (val !== 'pessimo') setWrittenOff(false);
                  }}
                  className={`flex h-10 w-full rounded-md border px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 font-medium
                    ${condition === 'otimo'   ? 'bg-green-50 border-green-300 text-green-800' :
                      condition === 'bom'     ? 'bg-blue-50  border-blue-300  text-blue-800'  :
                      condition === 'ruim'    ? 'bg-yellow-50 border-yellow-300 text-yellow-800' :
                      condition === 'pessimo' ? 'bg-red-50   border-red-300   text-red-800'   :
                      'bg-background border-input text-foreground'}`}
                >
                  <option value="">Selecionar</option>
                  <option value="otimo">✓ Ótimo</option>
                  <option value="bom">◎ Bom</option>
                  <option value="ruim">⚠ Ruim</option>
                  <option value="pessimo">✕ Péssimo</option>
                </select>
              </div>
            )}
          </div>

          {/* ── Written-off (CREATE-only, pessimo condition) ── */}
          {!isEditing && condition === 'pessimo' && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 space-y-2">
              <div className="flex items-center gap-2 text-red-700 text-sm font-medium">
                <AlertTriangle className="h-4 w-4" />
                Este bem está em estado Péssimo
              </div>
              <Label className="text-sm text-red-700">Foi dado baixa neste bem?</Label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setWrittenOff(true)}
                  className={`flex-1 py-2 px-4 rounded-md border text-sm font-medium transition-colors ${
                    writtenOff ? 'bg-red-600 border-red-600 text-white' : 'bg-white border-red-300 text-red-700 hover:bg-red-50'
                  }`}
                >
                  Sim, baixa dada
                </button>
                <button
                  type="button"
                  onClick={() => setWrittenOff(false)}
                  className={`flex-1 py-2 px-4 rounded-md border text-sm font-medium transition-colors ${
                    !writtenOff ? 'bg-gray-600 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Não, ainda em uso
                </button>
              </div>
            </div>
          )}

          {/* ── Written-off toggle for edit mode (always visible) ── */}
          {isEditing && (
            <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
              <AlertTriangle className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm flex-1">Bem dado como baixa (inativo)</span>
              <button
                type="button"
                onClick={() => setWrittenOff((v) => !v)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  writtenOff ? 'bg-destructive' : 'bg-muted-foreground/30'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    writtenOff ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          )}

          {/* ── Value & Date ── */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="pat-value">Valor (R$)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium pointer-events-none">R$</span>
                <Input
                  id="pat-value"
                  type="text"
                  inputMode="decimal"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder="0,00"
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pat-date">Data de Aquisição</Label>
              <Input
                id="pat-date"
                type="date"
                value={acquisitionDate}
                onChange={(e) => setAcquisitionDate(e.target.value)}
              />
            </div>
          </div>

          {/* ── Description ── */}
          <div className="space-y-2">
            <Label htmlFor="pat-description">Descrição</Label>
            <Input
              id="pat-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descrição do bem"
            />
          </div>

          {/* ── CREATE-ONLY: initial location & responsible ── */}
          {!isEditing && (
            <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
              <p className="text-sm font-medium text-muted-foreground">
                Localização e Responsável Inicial
              </p>
              <div className="space-y-2">
                <Label htmlFor="pat-location">Localização</Label>
                <Input
                  id="pat-location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Ex: Secretaria de Agricultura"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="pat-resp-name">Responsável</Label>
                  <Input
                    id="pat-resp-name"
                    value={responsibleName}
                    onChange={(e) => setResponsibleName(e.target.value)}
                    placeholder="Nome"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pat-resp-phone">WhatsApp</Label>
                  <Input
                    id="pat-resp-phone"
                    value={responsiblePhone}
                    onChange={(e) => setResponsiblePhone(e.target.value)}
                    placeholder="(66) 99999-9999"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Após o cadastro, use <strong>Registrar Movimentação</strong> para atualizar localização, responsável ou estado de conservação com rastreabilidade.
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Salvando...' : isEditing ? 'Salvar' : 'Cadastrar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
