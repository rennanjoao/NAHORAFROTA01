 import { useState } from "react";
 import { Button } from "@/components/ui/button";
 import { Badge } from "@/components/ui/badge";
 import { Copy, Check, Key } from "lucide-react";
 import { toast } from "@/hooks/use-toast";
 import {
   Tooltip,
   TooltipContent,
   TooltipProvider,
   TooltipTrigger,
 } from "@/components/ui/tooltip";
 
 interface PixCopyButtonProps {
   pixKey?: string;
   cpf?: string;
   compact?: boolean;
 }
 
 export function PixCopyButton({ pixKey, cpf, compact = false }: PixCopyButtonProps) {
   const [copied, setCopied] = useState(false);
 
   // Use PIX key if available, otherwise use CPF
   const keyToCopy = pixKey || cpf;
 
   const handleCopy = async () => {
     if (!keyToCopy) return;
 
     try {
       await navigator.clipboard.writeText(keyToCopy);
       setCopied(true);
       toast({
         title: "PIX Copiado.",
         description: `Chave PIX copiada para a área de transferência.`,
       });
       setTimeout(() => setCopied(false), 2000);
     } catch (err) {
       toast({
         title: "Erro ao copiar",
         description: "Não foi possível copiar a chave PIX.",
         variant: "destructive",
       });
     }
   };
 
   if (!keyToCopy) {
     return null;
   }
 
   if (compact) {
     return (
       <TooltipProvider>
         <Tooltip>
           <TooltipTrigger asChild>
             <Button
               size="icon"
               variant="ghost"
               className="h-6 w-6"
               onClick={handleCopy}
             >
               {copied ? (
                 <Check className="h-3 w-3 text-success" />
               ) : (
                 <Copy className="h-3 w-3" />
               )}
             </Button>
           </TooltipTrigger>
           <TooltipContent>
             <p>Copiar PIX: {keyToCopy}</p>
           </TooltipContent>
         </Tooltip>
       </TooltipProvider>
     );
   }
 
   return (
     <div className="flex items-center gap-2">
       <Badge variant="outline" className="gap-1 font-mono text-xs">
         <Key className="h-3 w-3" />
         {pixKey ? "PIX" : "CPF"}
       </Badge>
       <code className="text-xs font-mono text-muted-foreground truncate max-w-[120px]">
         {keyToCopy}
       </code>
       <TooltipProvider>
         <Tooltip>
           <TooltipTrigger asChild>
             <Button
               size="icon"
               variant="outline"
               className="h-6 w-6"
               onClick={handleCopy}
             >
               {copied ? (
                 <Check className="h-3 w-3 text-success" />
               ) : (
                 <Copy className="h-3 w-3" />
               )}
             </Button>
           </TooltipTrigger>
           <TooltipContent>
             <p>Copiar para área de transferência</p>
           </TooltipContent>
         </Tooltip>
       </TooltipProvider>
     </div>
   );
 }