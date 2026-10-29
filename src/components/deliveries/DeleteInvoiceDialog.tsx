 import {
   AlertDialog,
   AlertDialogAction,
   AlertDialogCancel,
   AlertDialogContent,
   AlertDialogDescription,
   AlertDialogFooter,
   AlertDialogHeader,
   AlertDialogTitle,
 } from "@/components/ui/alert-dialog";
 import { AlertTriangle, Trash2 } from "lucide-react";
 
 interface DeleteInvoiceDialogProps {
   open: boolean;
   onOpenChange: (open: boolean) => void;
   invoiceNfe: string;
   isLinkedToManifest: boolean;
   onConfirm: () => void;
   isDeleting?: boolean;
 }
 
 export function DeleteInvoiceDialog({
   open,
   onOpenChange,
   invoiceNfe,
   isLinkedToManifest,
   onConfirm,
   isDeleting = false,
 }: DeleteInvoiceDialogProps) {
   return (
     <AlertDialog open={open} onOpenChange={onOpenChange}>
       <AlertDialogContent>
         <AlertDialogHeader>
           <AlertDialogTitle className="flex items-center gap-2">
             {isLinkedToManifest ? (
               <AlertTriangle className="h-5 w-5 text-warning" />
             ) : (
               <Trash2 className="h-5 w-5 text-destructive" />
             )}
             {isLinkedToManifest ? "Ação não permitida" : "Excluir Nota Fiscal"}
           </AlertDialogTitle>
           <AlertDialogDescription className="space-y-3">
             {isLinkedToManifest ? (
               <>
                 <p>
                   A NF <strong className="font-mono">{invoiceNfe}</strong> está vinculada a um romaneio.
                 </p>
                 <p className="text-warning">
                   Para excluir esta nota fiscal, primeiro remova-a do romaneio através da opção 
                   "Remover do Romaneio" no menu de ações.
                 </p>
               </>
             ) : (
               <>
                 <p>
                   Tem certeza que deseja excluir a NF <strong className="font-mono">{invoiceNfe}</strong>?
                 </p>
                 <p className="text-destructive font-medium">
                   Esta ação é irreversível e apagará os dados do banco permanentemente.
                 </p>
                 <p className="text-muted-foreground text-sm">
                   Todos os arquivos anexos (XML/PDF) também serão removidos.
                 </p>
               </>
             )}
           </AlertDialogDescription>
         </AlertDialogHeader>
         <AlertDialogFooter>
           <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
           {!isLinkedToManifest && (
             <AlertDialogAction
               onClick={onConfirm}
               disabled={isDeleting}
               className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
             >
               {isDeleting ? "Excluindo..." : "Excluir Permanentemente"}
             </AlertDialogAction>
           )}
         </AlertDialogFooter>
       </AlertDialogContent>
     </AlertDialog>
   );
 }