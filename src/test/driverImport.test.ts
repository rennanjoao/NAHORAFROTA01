import { describe, expect, it } from "vitest";
import { parseCsv } from "@/lib/spreadsheet";
import { parseDriverRows } from "@/lib/driverImport";

describe("parseCsv", () => {
  it("detecta ';' e respeita aspas, BOM e quebra de linha no campo", () => {
    const rows = parseCsv('﻿Nome;Obs\r\n"Silva; Maria";"linha 1\nlinha 2"\r\n\r\nJoão;"dito ""ok"""\n');
    expect(rows).toEqual([
      ["Nome", "Obs"],
      ["Silva; Maria", "linha 1\nlinha 2"],
      ["João", 'dito "ok"'],
    ]);
  });

  it("aceita ',' como separador", () => {
    expect(parseCsv("a,b\n1,2")).toEqual([["a", "b"], ["1", "2"]]);
  });
});

describe("parseDriverRows", () => {
  const header = ["Nome Completo", "CPF", "Celular", "E-mail", "Placa", "Tipo de Veículo", "Frota"];

  it("aponta colunas obrigatorias ausentes", () => {
    expect(parseDriverRows([["Nome", "Placa"]], new Set()).missingColumns).toEqual(["cpf", "phone"]);
  });

  it("normaliza os dados e valida cada linha", () => {
    const { rows } = parseDriverRows(
      [
        header,
        ["  Maria  da Silva ", "52998224725", "11988887777", "MARIA@X.COM", "abc-1d23", "VUC 3/4", "Própria"],
        ["Zé", "111.111.111-11", "119", "x@", "12", "Bicicleta", ""],
        ["Ana", "529.982.247-25", "(11) 3333-4444", "", "", "", "Agregado"],
        ["Bia", "9876543229", "11 97777-6666", "", "", "", ""],
        ["Caio", "390.533.447-05", "11977776666", "", "", "", ""],
      ],
      new Set(["39053344705"]),
    );

    expect(rows[0]).toMatchObject({
      line: 2,
      errors: [],
      data: {
        name: "Maria da Silva",
        cpf: "529.982.247-25",
        phone: "(11) 98888-7777",
        contactEmail: "maria@x.com",
        vehiclePlate: "ABC1D23",
        vehicleType: "vuc",
        isOwnFleet: true,
      },
    });
    expect(rows[1].errors).toEqual([
      "CPF inválido",
      "Telefone inválido",
      "E-mail inválido",
      "Placa inválida",
      "Tipo de veículo desconhecido",
    ]);
    expect(rows[2].errors).toEqual(["CPF repetido (linha 2)"]);
    expect(rows[2].data).toMatchObject({ vehiclePlate: "PENDENTE", vehicleType: "van", isOwnFleet: false });
    // CPF salvo como numero no Excel perde o zero inicial.
    expect(rows[3].data.cpf).toBe("098.765.432-29");
    expect(rows[3].errors).toEqual([]);
    expect(rows[4].errors).toEqual(["CPF já cadastrado"]);
  });
});
