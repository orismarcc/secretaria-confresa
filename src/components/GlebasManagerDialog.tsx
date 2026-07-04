import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Pencil, Trash2, Check, X, Layers, MapPinned } from 'lucide-react';
import { useGlebas, useCreateGleba, useUpdateGleba, useDeleteGleba } from '@/hooks/useSupabaseData';

interface GlebasManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settlement: { id: string; name: string } | null;
}

export function GlebasManagerDialog({ open, onOpenChange, settlement }: GlebasManagerDialogProps) {
  const { data: allGlebas = [], isLoading } = useGlebas();
  const createGleba = useCreateGleba();
  const updateGleba = useUpdateGleba();
  const deleteGleba = useDeleteGleba();

  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  if (!settlement) return null;

  const glebas = (allGlebas as any[])
    .filter((g) => g.settlement_id === settlement.id)
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

  const handleAdd = () => {
    const name = newName.trim().toUpperCase();
    if (!name) return;
    createGleba.mutate(
      { name, settlement_id: settlement.id },
      { onSuccess: () => setNewName('') },
    );
  };

  const handleSaveEdit = () => {
    const name = editingName.trim().toUpperCase();
    if (!name || !editingId) return;
    updateGleba.mutate({ id: editingId, name }, { onSuccess: () => setEditingId(null) });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            Glebas — {settlement.name}
          </DialogTitle>
        </DialogHeader>

        {/* Adicionar */}
        <div className="flex gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value.toUpperCase())}
            placeholder="Nome da gleba"
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
          />
          <Button onClick={handleAdd} disabled={!newName.trim() || createGleba.isPending} className="shrink-0">
            <Plus className="h-4 w-4 mr-1" /> Adicionar
          </Button>
        </div>

        {/* Lista */}
        <div className="space-y-1.5 pt-1">
          {isLoading ? (
            <>
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </>
          ) : glebas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
              <MapPinned className="h-8 w-8 opacity-30" />
              <p className="text-sm">Nenhuma gleba cadastrada neste assentamento</p>
            </div>
          ) : (
            glebas.map((g) => (
              <div key={g.id} className="flex items-center gap-2 rounded-lg border px-3 py-2">
                {editingId === g.id ? (
                  <>
                    <Input
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value.toUpperCase())}
                      className="h-8"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveEdit();
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                    />
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-success" onClick={handleSaveEdit}>
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingId(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <Layers className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="flex-1 text-sm font-medium truncate">{g.name}</span>
                    <Button
                      size="icon" variant="ghost" className="h-8 w-8"
                      onClick={() => { setEditingId(g.id); setEditingName(g.name); }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon" variant="ghost"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => deleteGleba.mutate(g.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
