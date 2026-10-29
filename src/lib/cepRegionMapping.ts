 // Mapeamento de CEP para Região Logística
 // Função utilitária para uso no frontend
 
 export interface RegionInfo {
   code: string;
   name: string;
   category: 'capital' | 'gsp' | 'interior' | 'litoral' | 'outra';
 }
 
 export const LOGISTICS_REGIONS: RegionInfo[] = [
   // SÃO PAULO CAPITAL
   { code: 'SP_CENTRAL', name: 'SP - Zona Central', category: 'capital' },
   { code: 'SP_NORTE', name: 'SP - Zona Norte', category: 'capital' },
   { code: 'SP_LESTE', name: 'SP - Zona Leste', category: 'capital' },
   { code: 'SP_SUL', name: 'SP - Zona Sul', category: 'capital' },
   { code: 'SP_OESTE', name: 'SP - Zona Oeste', category: 'capital' },
   { code: 'SP_SUL_EXTREMO', name: 'SP - Zona Sul (Extremo)', category: 'capital' },
   { code: 'SP_LESTE_EXTREMO', name: 'SP - Zona Leste (Extremo)', category: 'capital' },
   // GRANDE SÃO PAULO
   { code: 'GSP_OESTE', name: 'GSP - Oeste (Osasco/Barueri)', category: 'gsp' },
   { code: 'GSP_NORTE', name: 'GSP - Norte (Guarulhos)', category: 'gsp' },
   { code: 'GSP_LESTE', name: 'GSP - Leste (Mogi/Suzano)', category: 'gsp' },
   { code: 'GSP_ABC', name: 'GSP - ABC Paulista', category: 'gsp' },
   // LITORAL
   { code: 'LITORAL_SANTOS', name: 'Litoral - Baixada Santista', category: 'litoral' },
   // INTERIOR
   { code: 'INT_REGISTRO', name: 'Interior - RA Registro', category: 'interior' },
   { code: 'INT_VALE_PARAIBA', name: 'Interior - RA Vale do Paraíba', category: 'interior' },
   { code: 'INT_CAMPINAS', name: 'Interior - RA Campinas', category: 'interior' },
   { code: 'INT_CENTRAL', name: 'Interior - RA Central (Araraquara/S. Carlos)', category: 'interior' },
   { code: 'INT_RIBEIRAO', name: 'Interior - RA Ribeirão Preto', category: 'interior' },
   { code: 'INT_RIO_PRETO', name: 'Interior - RA S. José do Rio Preto', category: 'interior' },
   { code: 'INT_ARACATUBA', name: 'Interior - RA Araçatuba', category: 'interior' },
   { code: 'INT_BAURU', name: 'Interior - RA Bauru', category: 'interior' },
   { code: 'INT_MARILIA', name: 'Interior - RA Marília', category: 'interior' },
   { code: 'INT_SOROCABA', name: 'Interior - RA Sorocaba', category: 'interior' },
   { code: 'INT_PRUDENTE', name: 'Interior - RA Pres. Prudente', category: 'interior' },
   // OUTRAS
   { code: 'OUTRA', name: 'Outra Região', category: 'outra' },
 ];
 
 export function calculateRegiaoLogistica(cep: string | null | undefined): string {
   if (!cep) return 'Outra Região';
   
   // Remove hífen e espaços
   const cepClean = cep.replace(/[^0-9]/g, '');
   
   // Se não tiver 8 dígitos, retorna outra região
   if (cepClean.length !== 8) return 'Outra Região';
   
   // Pega os primeiros 5 dígitos para comparação de faixa
   const cepNumber = parseInt(cepClean.substring(0, 5), 10);
   
   // SÃO PAULO CAPITAL
   if (cepNumber >= 1000 && cepNumber <= 1599) return 'SP - Zona Central';
   if (cepNumber >= 2000 && cepNumber <= 2999) return 'SP - Zona Norte';
   if (cepNumber >= 3000 && cepNumber <= 3999) return 'SP - Zona Leste';
   if (cepNumber >= 4000 && cepNumber <= 4999) return 'SP - Zona Sul';
   if (cepNumber >= 5000 && cepNumber <= 5799) return 'SP - Zona Oeste';
   if (cepNumber >= 5800 && cepNumber <= 5899) return 'SP - Zona Sul (Extremo)';
   if (cepNumber >= 8000 && cepNumber <= 8499) return 'SP - Zona Leste (Extremo)';
   
   // GRANDE SÃO PAULO
   if (cepNumber >= 6000 && cepNumber <= 6699) return 'GSP - Oeste (Osasco/Barueri)';
   if (cepNumber >= 7000 && cepNumber <= 7999) return 'GSP - Norte (Guarulhos)';
   if (cepNumber >= 8500 && cepNumber <= 8999) return 'GSP - Leste (Mogi/Suzano)';
   if (cepNumber >= 9000 && cepNumber <= 9999) return 'GSP - ABC Paulista';
   
   // INTERIOR E LITORAL
   if (cepNumber >= 11000 && cepNumber <= 11899) return 'Litoral - Baixada Santista';
   if (cepNumber >= 11900 && cepNumber <= 11999) return 'Interior - RA Registro';
   if (cepNumber >= 12000 && cepNumber <= 12999) return 'Interior - RA Vale do Paraíba';
   if (cepNumber >= 13000 && cepNumber <= 13499) return 'Interior - RA Campinas';
   if (cepNumber >= 13500 && cepNumber <= 13999) return 'Interior - RA Central (Araraquara/S. Carlos)';
   if (cepNumber >= 14000 && cepNumber <= 14999) return 'Interior - RA Ribeirão Preto';
   if (cepNumber >= 15000 && cepNumber <= 15999) return 'Interior - RA S. José do Rio Preto';
   if (cepNumber >= 16000 && cepNumber <= 16399) return 'Interior - RA Araçatuba';
   if (cepNumber >= 16400 && cepNumber <= 17199) return 'Interior - RA Bauru';
   if (cepNumber >= 17200 && cepNumber <= 17999) return 'Interior - RA Marília';
   if (cepNumber >= 18000 && cepNumber <= 18999) return 'Interior - RA Sorocaba';
   if (cepNumber >= 19000 && cepNumber <= 19999) return 'Interior - RA Pres. Prudente';
   
   return 'Outra Região';
 }
 
 export function getRegionColor(region: string): string {
   // Capital - tons de azul
   if (region.startsWith('SP -')) {
     if (region.includes('Central')) return 'bg-blue-500';
     if (region.includes('Norte')) return 'bg-blue-400';
     if (region.includes('Sul')) return 'bg-blue-600';
     if (region.includes('Leste')) return 'bg-blue-300';
     if (region.includes('Oeste')) return 'bg-blue-700';
     return 'bg-blue-500';
   }
   
   // GSP - tons de verde
   if (region.startsWith('GSP')) {
     if (region.includes('Oeste')) return 'bg-emerald-500';
     if (region.includes('Norte')) return 'bg-emerald-400';
     if (region.includes('Leste')) return 'bg-emerald-600';
     if (region.includes('ABC')) return 'bg-emerald-700';
     return 'bg-emerald-500';
   }
   
   // Litoral - tons de cyan
   if (region.startsWith('Litoral')) return 'bg-cyan-500';
   
   // Interior - tons de amber/orange
   if (region.startsWith('Interior')) {
     if (region.includes('Campinas')) return 'bg-amber-500';
     if (region.includes('Ribeirão')) return 'bg-amber-600';
     if (region.includes('Sorocaba')) return 'bg-orange-500';
     if (region.includes('Vale')) return 'bg-amber-400';
     return 'bg-amber-500';
   }
   
   return 'bg-gray-500';
 }
 
 export function getCategoryLabel(category: RegionInfo['category']): string {
   switch (category) {
     case 'capital': return 'São Paulo Capital';
     case 'gsp': return 'Grande São Paulo';
     case 'interior': return 'Interior';
     case 'litoral': return 'Litoral';
     default: return 'Outras';
   }
 }