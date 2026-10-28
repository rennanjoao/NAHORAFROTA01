 import { useState } from "react";
 import {
   Dialog,
   DialogContent,
   DialogHeader,
   DialogTitle,
 } from "@/components/ui/dialog";
 import { Button } from "@/components/ui/button";
 import { Badge } from "@/components/ui/badge";
 import { Copy, Check, Building2, CreditCard, Key } from "lucide-react";
 import { toast } from "@/hooks/use-toast";
 
 interface BankDetails {
   banco?: string;
   agencia?: string;
   conta?: string;
   tipo_conta?: string;
   chave_pix?: string;
   cpf?: string;
   driverName?: string;
 }
 
 interface BankDetailsDialogProps {
   open: boolean;
   onOpenChange: (open: boolean) => void;
   bankDetails: BankDetails;
 }
 
 export function BankDetailsDialog({ open, onOpenChange, bankDetails }: BankDetailsDialogProps) {
   const [copiedField, setCopiedField] = useState<string | null>(null);
 
   const handleCopy = async (text: string, field: string) => {
     try {
       await navigator.clipboard.writeText(text);
       setCopiedField(field);
       toast({
         title: "✅ Copiado!",
         description: `${field} copiado para a área de transferência.`,
       });
       setTimeout(() => setCopiedField(null), 2000);
     } catch (err) {
       toast({
         title: "❌ Erro ao copiar",
         description: "Não foi possível copiar o texto.",
         variant: "destructive",
       });
     }
   };
 
   const tipoContaLabels: Record<string, string> = {
     corrente: "Conta Corrente",
     poupanca: "Conta Poupança",
     salario: "Conta Salário",
   };
 
   const hasBankData = bankDetails.banco || bankDetails.agencia || bankDetails.conta;
 
   return (
     <Dialog open={open} onOpenChange={onOpenChange}>
       <DialogContent className="sm:max-w-md">
         <DialogHeader>
           <DialogTitle className="flex items-center gap-2">
             <Building2 className="h-5 w-5 text-primary" />
             Dados Bancários
           </DialogTitle>
         </DialogHeader>
 
         <div className="space-y-4 py-4">
           {/* Driver Name */}
           {bankDetails.driverName && (
             <div className="text-center pb-4 border-b">
               <p className="font-semibold text-lg">{bankDetails.driverName}</p>
               {bankDetails.cpf && (
                 <p className="text-sm text-muted-foreground font-mono">CPF: {bankDetails.cpf}</p>
               )}
             </div>
           )}
 
           {/* PIX Section */}
           <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
             <div className="flex items-center gap-2 mb-3">
               <Key className="h-4 w-4 text-primary" />
               <span className="font-semibold text-primary">Chave PIX</span>
             </div>
             {bankDetails.chave_pix ? (
               <div className="flex items-center gap-2">
                 <code className="flex-1 p-2 bg-background rounded border font-mono text-sm truncate">
                   {bankDetails.chave_pix}
                 </code>
                 <Button
                   size="sm"
                   variant="outline"
                   onClick={() => handleCopy(bankDetails.chave_pix!, "Chave PIX")}
                   className="shrink-0"
                 >
                   {copiedField === "Chave PIX" ? (
                     <Check className="h-4 w-4 text-success" />
                   ) : (
                     <Copy className="h-4 w-4" />
                   )}
                 </Button>
               </div>
             ) : (
               <p className="text-sm text-muted-foreground italic">Chave PIX não cadastrada</p>
             )}
           </div>
 
           {/* Bank Data Section */}
           <div className="p-4 rounded-lg bg-muted/30 border">
             <div className="flex items-center gap-2 mb-3">
               <CreditCard className="h-4 w-4" />
               <span className="font-semibold">Dados para TED/DOC</span>
             </div>
             
             {hasBankData ? (
               <div className="space-y-3">
                 <div className="grid grid-cols-2 gap-4">
                   <div>
                     <p className="text-xs text-muted-foreground mb-1">Banco</p>
                     <p className="font-mono font-medium">{bankDetails.banco || "-"}</p>
                   </div>
                   <div>
                     <p className="text-xs text-muted-foreground mb-1">Tipo de Conta</p>
                     <Badge variant="secondary">
                       {tipoContaLabels[bankDetails.tipo_conta || "corrente"] || bankDetails.tipo_conta}
                     </Badge>
                   </div>
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                   <div>
                     <p className="text-xs text-muted-foreground mb-1">Agência</p>
                     <div className="flex items-center gap-2">
                       <p className="font-mono font-medium">{bankDetails.agencia || "-"}</p>
                       {bankDetails.agencia && (
                         <Button
                           size="icon"
                           variant="ghost"
                           className="h-6 w-6"
                           onClick={() => handleCopy(bankDetails.agencia!, "Agência")}
                         >
                           {copiedField === "Agência" ? (
                             <Check className="h-3 w-3 text-success" />
                           ) : (
                             <Copy className="h-3 w-3" />
                           )}
                         </Button>
                       )}
                     </div>
                   </div>
                   <div>
                     <p className="text-xs text-muted-foreground mb-1">Conta</p>
                     <div className="flex items-center gap-2">
                       <p className="font-mono font-medium">{bankDetails.conta || "-"}</p>
                       {bankDetails.conta && (
                         <Button
                           size="icon"
                           variant="ghost"
                           className="h-6 w-6"
                           onClick={() => handleCopy(bankDetails.conta!, "Conta")}
                         >
                           {copiedField === "Conta" ? (
                             <Check className="h-3 w-3 text-success" />
                           ) : (
                             <Copy className="h-3 w-3" />
                           )}
                         </Button>
                       )}
                     </div>
                   </div>
                 </div>
               </div>
             ) : (
               <p className="text-sm text-muted-foreground italic">Dados bancários não cadastrados</p>
             )}
           </div>
         </div>
       </DialogContent>
     </Dialog>
   );
 }