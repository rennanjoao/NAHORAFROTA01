
# Plano: Reestruturar Fluxo de Criacao de Romaneio

## Problema Identificado
Atualmente o `FreightDialog.tsx` tem o fluxo:
1. Roteirizacao (calcula rota)
2. Frete (define valor)
3. Motorista (seleciona + toggle "Frota Propria" no final)
4. Confirmacao

O usuario precisa:
- Definir tipo de frota **PRIMEIRO** (Frota Propria vs Terceiro)
- Se Frota Propria: **NAO** mostrar etapa de frete (nao gera acerto financeiro)
- Filtrar motoristas por tipo (CLT vs Agregado)
- Selecionar veiculo da casa se for Frota Propria

## Nova Arquitetura do Fluxo

```text
NOVO FLUXO:

[1. TIPO DE FROTA]          [2. ROTEIRIZACAO]         [3. FRETE*]              [4. MOTORISTA]           [5. CONFIRMACAO]
     |                            |                        |                        |                        |
     v                            v                        v                        v                        v
+---------------+          +---------------+         +---------------+        +---------------+        +---------------+
| Terceiro ou   |   --->   | Calcular rota |  --->   | Valor do      |  --->  | Selecionar    |  --->  | Resumo final  |
| Frota Propria |          | Retorno base  |         | frete         |        | motorista     |        | e confirmar   |
+---------------+          +---------------+         +---------------+        +---------------+        +---------------+
                                                           |
                                                           | *PULAR se Frota Propria
                                                           v
                                                     (direto para motorista)
```

## Detalhes Tecnicos

### 1. Novo Step "fleet_type" como Primeiro Passo
- Adicionar estado `fleetType: "third_party" | "own_fleet" | null`
- Usar os mesmos cards visuais do `ManifestDriverSelector.tsx`
- Atualizar array de steps: `["fleet_type", "route", "freight", "driver", "preview"]`

### 2. Logica Condicional para Pular Frete
```typescript
const handleNextStep = () => {
  if (step === "fleet_type") {
    setStep("route");
  } else if (step === "route") {
    // Se frota propria, pular direto para motorista
    if (fleetType === "own_fleet") {
      setStep("driver");
    } else {
      setStep("freight");
    }
  } else if (step === "freight") {
    setStep("driver");
  } else if (step === "driver") {
    setStep("preview");
  }
};
```

### 3. Integracao com Hook `useDBDrivers`
Atualizar a selecao de motoristas para usar o banco de dados:
- Filtrar por `is_own_fleet = true` para Frota Propria (motoristas CLT)
- Filtrar por `is_own_fleet = false` para Terceiros/Agregados
- Adicionar filtro extra: motoristas que **NAO** estejam vinculados a romaneio ativo

### 4. Selecao de Veiculo da Casa (apenas Frota Propria)
Usar `companyVehicleStore.getAvailable()` para listar veiculos disponiveis quando `fleetType === "own_fleet"`.

### 5. Ajuste no Preview e Confirmacao
- Se Frota Propria: mostrar `calculatedTotal = 0` ou ocultar valor
- Armazenar `isOwnVehicle: true` e `vehicleId` no manifesto
- Badge visual diferenciando "Frota Propria (sem acerto)" vs "Terceiro (gera acerto)"

## Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `src/components/deliveries/FreightDialog.tsx` | Reestruturar steps, adicionar fleet_type como primeiro passo, logica condicional para pular frete |
| `src/components/deliveries/DriverCombobox.tsx` | Adicionar prop `fleetType` para filtrar motoristas por tipo |
| `src/stores/manifestStore.ts` | Garantir que `isOwnVehicle` e `vehicleId` sejam salvos corretamente |

## Beneficios
1. **Fluxo mais intuitivo**: Usuario decide tipo de operacao primeiro
2. **Menos etapas para frota propria**: Pula etapa de frete desnecessaria
3. **Dados corretos no acerto**: Frota propria nao aparecera em calculos de pagamento
4. **Consistencia visual**: Usa mesmos componentes do `ManifestDriverSelectorDB`
5. **Validacao de disponibilidade**: Filtra motoristas/veiculos ja alocados
