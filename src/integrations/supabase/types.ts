export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      app_config: {
        Row: {
          key: string
          value: string
        }
        Insert: {
          key: string
          value: string
        }
        Update: {
          key?: string
          value?: string
        }
        Relationships: []
      }
      billing_notices: {
        Row: {
          acknowledged_at: string | null
          channel: string
          created_at: string
          id: string
          notes: string | null
          notice_type: string
          reference_date: string
          shown_at: string
          tenant_id: string
          user_id: string | null
        }
        Insert: {
          acknowledged_at?: string | null
          channel?: string
          created_at?: string
          id?: string
          notes?: string | null
          notice_type: string
          reference_date: string
          shown_at?: string
          tenant_id: string
          user_id?: string | null
        }
        Update: {
          acknowledged_at?: string | null
          channel?: string
          created_at?: string
          id?: string
          notes?: string | null
          notice_type?: string
          reference_date?: string
          shown_at?: string
          tenant_id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      carriers: {
        Row: {
          active: boolean
          agencia: string | null
          banco: string | null
          chave_pix: string | null
          cidade: string | null
          cnpj: string
          conta: string | null
          created_at: string
          email: string | null
          id: string
          ie_isento: boolean
          inscricao_estadual: string | null
          nome_fantasia: string | null
          razao_social: string
          telefone: string | null
          tenant_id: string
          tipo_conta: string | null
          uf: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          agencia?: string | null
          banco?: string | null
          chave_pix?: string | null
          cidade?: string | null
          cnpj: string
          conta?: string | null
          created_at?: string
          email?: string | null
          id?: string
          ie_isento?: boolean
          inscricao_estadual?: string | null
          nome_fantasia?: string | null
          razao_social: string
          telefone?: string | null
          tenant_id: string
          tipo_conta?: string | null
          uf?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          agencia?: string | null
          banco?: string | null
          chave_pix?: string | null
          cidade?: string | null
          cnpj?: string
          conta?: string | null
          created_at?: string
          email?: string | null
          id?: string
          ie_isento?: boolean
          inscricao_estadual?: string | null
          nome_fantasia?: string | null
          razao_social?: string
          telefone?: string | null
          tenant_id?: string
          tipo_conta?: string | null
          uf?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      company_vehicles: {
        Row: {
          brand: string
          capacity: string | null
          created_at: string
          current_driver_id: string | null
          current_driver_name: string | null
          id: string
          model: string
          photo_url: string | null
          plate: string
          renavam: string | null
          status: string
          tenant_id: string | null
          type: string
          updated_at: string
          year: number | null
        }
        Insert: {
          brand: string
          capacity?: string | null
          created_at?: string
          current_driver_id?: string | null
          current_driver_name?: string | null
          id?: string
          model: string
          photo_url?: string | null
          plate: string
          renavam?: string | null
          status?: string
          tenant_id?: string | null
          type: string
          updated_at?: string
          year?: number | null
        }
        Update: {
          brand?: string
          capacity?: string | null
          created_at?: string
          current_driver_id?: string | null
          current_driver_name?: string | null
          id?: string
          model?: string
          photo_url?: string | null
          plate?: string
          renavam?: string | null
          status?: string
          tenant_id?: string | null
          type?: string
          updated_at?: string
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "company_vehicles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      deliveries: {
        Row: {
          address: string | null
          created_at: string | null
          customer_name: string | null
          delivered_at: string | null
          driver_id: string | null
          id: string
          invoice_id: string | null
          manifest_id: string | null
          notes: string | null
          proof_photo_url: string | null
          recipient_doc: string | null
          recipient_name: string | null
          status: string | null
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          customer_name?: string | null
          delivered_at?: string | null
          driver_id?: string | null
          id?: string
          invoice_id?: string | null
          manifest_id?: string | null
          notes?: string | null
          proof_photo_url?: string | null
          recipient_doc?: string | null
          recipient_name?: string | null
          status?: string | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          customer_name?: string | null
          delivered_at?: string | null
          driver_id?: string | null
          id?: string
          invoice_id?: string | null
          manifest_id?: string | null
          notes?: string | null
          proof_photo_url?: string | null
          recipient_doc?: string | null
          recipient_name?: string | null
          status?: string | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "vw_drivers_operational"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "vw_drivers_with_gps_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "vw_invoices_for_drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_manifest_id_fkey"
            columns: ["manifest_id"]
            isOneToOne: false
            referencedRelation: "manifests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_occurrences: {
        Row: {
          created_at: string | null
          delivery_id: string | null
          description: string | null
          driver_id: string | null
          id: string
          invoice_id: string | null
          lat: number | null
          lng: number | null
          occurrence_type: string
          photo_url: string | null
          tenant_id: string | null
        }
        Insert: {
          created_at?: string | null
          delivery_id?: string | null
          description?: string | null
          driver_id?: string | null
          id?: string
          invoice_id?: string | null
          lat?: number | null
          lng?: number | null
          occurrence_type: string
          photo_url?: string | null
          tenant_id?: string | null
        }
        Update: {
          created_at?: string | null
          delivery_id?: string | null
          description?: string | null
          driver_id?: string | null
          id?: string
          invoice_id?: string | null
          lat?: number | null
          lng?: number | null
          occurrence_type?: string
          photo_url?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_occurrences_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_occurrences_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_occurrences_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "vw_drivers_operational"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_occurrences_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "vw_drivers_with_gps_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_occurrences_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_occurrences_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "vw_invoices_for_drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_occurrences_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_proofs: {
        Row: {
          created_at: string
          delivered_at: string
          driver_id: string
          id: string
          invoice_id: string
          latitude: number | null
          longitude: number | null
          photo_url: string
          receiver_document: string | null
          receiver_name: string | null
          signature_url: string | null
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          delivered_at?: string
          driver_id: string
          id?: string
          invoice_id: string
          latitude?: number | null
          longitude?: number | null
          photo_url: string
          receiver_document?: string | null
          receiver_name?: string | null
          signature_url?: string | null
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          delivered_at?: string
          driver_id?: string
          id?: string
          invoice_id?: string
          latitude?: number | null
          longitude?: number | null
          photo_url?: string
          receiver_document?: string | null
          receiver_name?: string | null
          signature_url?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_proofs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_activity_logs: {
        Row: {
          activity_type: string
          client_name: string | null
          created_at: string
          driver_id: string
          id: string
          latitude: number | null
          longitude: number | null
          manifest_id: string | null
          notes: string | null
          occurrence_type: string | null
          tenant_id: string | null
        }
        Insert: {
          activity_type: string
          client_name?: string | null
          created_at?: string
          driver_id: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          manifest_id?: string | null
          notes?: string | null
          occurrence_type?: string | null
          tenant_id?: string | null
        }
        Update: {
          activity_type?: string
          client_name?: string | null
          created_at?: string
          driver_id?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          manifest_id?: string | null
          notes?: string | null
          occurrence_type?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_activity_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_occurrences: {
        Row: {
          created_at: string
          description: string | null
          driver_id: string
          id: string
          latitude: number | null
          longitude: number | null
          photo_url: string | null
          tenant_id: string | null
          type: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          driver_id: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          photo_url?: string | null
          tenant_id?: string | null
          type: string
        }
        Update: {
          created_at?: string
          description?: string | null
          driver_id?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          photo_url?: string | null
          tenant_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_occurrences_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_wallet: {
        Row: {
          amount: number
          category: string | null
          created_at: string
          date: string
          description: string
          driver_id: string
          id: string
          manifest_id: string | null
          observation: string | null
          route_id: string | null
          status: string
          tenant_id: string | null
          type: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          category?: string | null
          created_at?: string
          date?: string
          description: string
          driver_id: string
          id?: string
          manifest_id?: string | null
          observation?: string | null
          route_id?: string | null
          status?: string
          tenant_id?: string | null
          type?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string
          date?: string
          description?: string
          driver_id?: string
          id?: string
          manifest_id?: string | null
          observation?: string | null
          route_id?: string | null
          status?: string
          tenant_id?: string | null
          type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_wallet_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      drivers: {
        Row: {
          address: string | null
          agencia: string | null
          avatar: string
          banco: string | null
          chave_pix: string | null
          carrier_id: string | null
          cnh: string
          cnh_category: string
          cnh_expiry_date: string | null
          cnh_number: string | null
          cnh_photo_url: string | null
          conta: string | null
          cpf: string
          created_at: string
          current_delay: number | null
          daily_sla: number | null
          deliveries_completed: number | null
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          finished_time: string | null
          gps_signal_status: string | null
          id: string
          individual_sla: number | null
          is_own_fleet: boolean | null
          last_gps_update: string | null
          name: string | null
          phone: string
          photo: string | null
          photo_url: string | null
          status: string
          tenant_id: string | null
          tipo_conta: string | null
          total_deliveries: number | null
          updated_at: string
          user_id: string | null
          vehicle_document_url: string | null
          vehicle_photo_url: string | null
          vehicle_plate: string
          vehicle_type: string
          contact_email: string | null
          credentials_email_sent_at: string | null
        }
        Insert: {
          address?: string | null
          agencia?: string | null
          avatar: string
          banco?: string | null
          chave_pix?: string | null
          carrier_id?: string | null
          cnh: string
          cnh_category: string
          cnh_expiry_date?: string | null
          cnh_number?: string | null
          cnh_photo_url?: string | null
          conta?: string | null
          cpf: string
          created_at?: string
          current_delay?: number | null
          daily_sla?: number | null
          deliveries_completed?: number | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          finished_time?: string | null
          gps_signal_status?: string | null
          id?: string
          individual_sla?: number | null
          is_own_fleet?: boolean | null
          last_gps_update?: string | null
          name?: string | null
          phone: string
          photo?: string | null
          photo_url?: string | null
          status?: string
          tenant_id?: string | null
          tipo_conta?: string | null
          total_deliveries?: number | null
          updated_at?: string
          user_id?: string | null
          vehicle_document_url?: string | null
          vehicle_photo_url?: string | null
          vehicle_plate: string
          vehicle_type: string
          contact_email?: string | null
          credentials_email_sent_at?: string | null
        }
        Update: {
          address?: string | null
          agencia?: string | null
          avatar?: string
          banco?: string | null
          chave_pix?: string | null
          carrier_id?: string | null
          cnh?: string
          cnh_category?: string
          cnh_expiry_date?: string | null
          cnh_number?: string | null
          cnh_photo_url?: string | null
          conta?: string | null
          cpf?: string
          created_at?: string
          current_delay?: number | null
          daily_sla?: number | null
          deliveries_completed?: number | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          finished_time?: string | null
          gps_signal_status?: string | null
          id?: string
          individual_sla?: number | null
          is_own_fleet?: boolean | null
          last_gps_update?: string | null
          name?: string | null
          phone?: string
          photo?: string | null
          photo_url?: string | null
          status?: string
          tenant_id?: string | null
          tipo_conta?: string | null
          total_deliveries?: number | null
          updated_at?: string
          user_id?: string | null
          vehicle_document_url?: string | null
          vehicle_photo_url?: string | null
          vehicle_plate?: string
          vehicle_type?: string
          contact_email?: string | null
          credentials_email_sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "drivers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      fleet_positions: {
        Row: {
          accuracy: number | null
          battery_level: number | null
          created_at: string | null
          current_delay: number | null
          deliveries_completed: number | null
          driver_id: string
          driver_name: string
          heading: number | null
          id: string
          individual_sla: number | null
          is_active: boolean | null
          last_update: string | null
          latitude: number
          longitude: number
          phone: string | null
          speed: number | null
          status: string | null
          tenant_id: string | null
          total_deliveries: number | null
          vehicle_plate: string | null
          vehicle_type: string | null
        }
        Insert: {
          accuracy?: number | null
          battery_level?: number | null
          created_at?: string | null
          current_delay?: number | null
          deliveries_completed?: number | null
          driver_id: string
          driver_name: string
          heading?: number | null
          id?: string
          individual_sla?: number | null
          is_active?: boolean | null
          last_update?: string | null
          latitude: number
          longitude: number
          phone?: string | null
          speed?: number | null
          status?: string | null
          tenant_id?: string | null
          total_deliveries?: number | null
          vehicle_plate?: string | null
          vehicle_type?: string | null
        }
        Update: {
          accuracy?: number | null
          battery_level?: number | null
          created_at?: string | null
          current_delay?: number | null
          deliveries_completed?: number | null
          driver_id?: string
          driver_name?: string
          heading?: number | null
          id?: string
          individual_sla?: number | null
          is_active?: boolean | null
          last_update?: string | null
          latitude?: number
          longitude?: number
          phone?: string | null
          speed?: number | null
          status?: string | null
          tenant_id?: string | null
          total_deliveries?: number | null
          vehicle_plate?: string | null
          vehicle_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fleet_positions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      funnel_events: {
        Row: {
          created_at: string
          event: string
          id: number
          metadata: Json
          path: string | null
          tenant_id: string | null
          user_id: string | null
          visitor_id: string
        }
        Insert: {
          created_at?: string
          event: string
          id?: number
          metadata?: Json
          path?: string | null
          tenant_id?: string | null
          user_id?: string | null
          visitor_id: string
        }
        Update: {
          created_at?: string
          event?: string
          id?: number
          metadata?: Json
          path?: string | null
          tenant_id?: string | null
          user_id?: string | null
          visitor_id?: string
        }
        Relationships: []
      }
      invoices: {
        Row: {
          access_key: string
          address_city: string | null
          address_full: string
          address_neighborhood: string | null
          address_number: string | null
          address_state: string | null
          address_street: string | null
          address_zip: string | null
          delivered_at: string | null
          driver_id: string | null
          id: string
          imported_at: string
          imported_by: string | null
          latitude: number | null
          longitude: number | null
          manifest_id: string | null
          nfe_number: string | null
          observation: string | null
          occurrence_type: string | null
          receiver_document: string | null
          receiver_name: string | null
          recipient_name: string
          recipient_phone: string | null
          regiao_logistica: string | null
          route_sequence: number | null
          status: string
          tenant_id: string | null
          total_value: number
          total_weight: number | null
          updated_at: string
          updated_by: string | null
          volume_quantity: number | null
          xml_raw: string | null
          arrival_distance_m: number | null
          arrived_at: string | null
        }
        Insert: {
          access_key: string
          address_city?: string | null
          address_full: string
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          delivered_at?: string | null
          driver_id?: string | null
          id?: string
          imported_at?: string
          imported_by?: string | null
          latitude?: number | null
          longitude?: number | null
          manifest_id?: string | null
          nfe_number?: string | null
          observation?: string | null
          occurrence_type?: string | null
          receiver_document?: string | null
          receiver_name?: string | null
          recipient_name: string
          recipient_phone?: string | null
          regiao_logistica?: string | null
          route_sequence?: number | null
          status?: string
          tenant_id?: string | null
          total_value?: number
          total_weight?: number | null
          updated_at?: string
          updated_by?: string | null
          volume_quantity?: number | null
          xml_raw?: string | null
          arrival_distance_m?: number | null
          arrived_at?: string | null
        }
        Update: {
          access_key?: string
          address_city?: string | null
          address_full?: string
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          delivered_at?: string | null
          driver_id?: string | null
          id?: string
          imported_at?: string
          imported_by?: string | null
          latitude?: number | null
          longitude?: number | null
          manifest_id?: string | null
          nfe_number?: string | null
          observation?: string | null
          occurrence_type?: string | null
          receiver_document?: string | null
          receiver_name?: string | null
          recipient_name?: string
          recipient_phone?: string | null
          regiao_logistica?: string | null
          route_sequence?: number | null
          status?: string
          tenant_id?: string | null
          total_value?: number
          total_weight?: number | null
          updated_at?: string
          updated_by?: string | null
          volume_quantity?: number | null
          xml_raw?: string | null
          arrival_distance_m?: number | null
          arrived_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      manifest_audit_logs: {
        Row: {
          action_type: string
          created_at: string
          details: Json | null
          id: string
          invoice_id: string | null
          manifest_id: string
          notes: string | null
          performed_by: string | null
          performed_by_name: string | null
          tenant_id: string | null
          user_full_name: string | null
        }
        Insert: {
          action_type: string
          created_at?: string
          details?: Json | null
          id?: string
          invoice_id?: string | null
          manifest_id: string
          notes?: string | null
          performed_by?: string | null
          performed_by_name?: string | null
          tenant_id?: string | null
          user_full_name?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string
          details?: Json | null
          id?: string
          invoice_id?: string | null
          manifest_id?: string
          notes?: string | null
          performed_by?: string | null
          performed_by_name?: string | null
          tenant_id?: string | null
          user_full_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "manifest_audit_logs_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manifest_audit_logs_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "vw_invoices_for_drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manifest_audit_logs_manifest_id_fkey"
            columns: ["manifest_id"]
            isOneToOne: false
            referencedRelation: "manifests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manifest_audit_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      manifests: {
        Row: {
          company_vehicle_id: string | null
          created_at: string
          created_by: string | null
          deliveries_count: number
          driver_cpf: string | null
          driver_id: string | null
          driver_name: string
          estimated_distance: number | null
          freight_type: string
          freight_value: number
          id: string
          is_own_fleet: boolean | null
          manifest_code: string
          manifest_number: number | null
          observation: string | null
          paid_at: string | null
          per_km_value: number | null
          provider_invoice_id: string | null
          scheduled_date: string
          status: string
          tenant_id: string | null
          total_value: number | null
          total_weight: number | null
          updated_at: string
          vehicle_plate: string | null
          vehicle_type: string | null
          had_occurrence: boolean
        }
        Insert: {
          company_vehicle_id?: string | null
          created_at?: string
          created_by?: string | null
          deliveries_count?: number
          driver_cpf?: string | null
          driver_id?: string | null
          driver_name: string
          estimated_distance?: number | null
          freight_type?: string
          freight_value?: number
          id?: string
          is_own_fleet?: boolean | null
          manifest_code: string
          manifest_number?: number | null
          observation?: string | null
          paid_at?: string | null
          per_km_value?: number | null
          provider_invoice_id?: string | null
          scheduled_date?: string
          status?: string
          tenant_id?: string | null
          total_value?: number | null
          total_weight?: number | null
          updated_at?: string
          vehicle_plate?: string | null
          vehicle_type?: string | null
          had_occurrence?: boolean
        }
        Update: {
          company_vehicle_id?: string | null
          created_at?: string
          created_by?: string | null
          deliveries_count?: number
          driver_cpf?: string | null
          driver_id?: string | null
          driver_name?: string
          estimated_distance?: number | null
          freight_type?: string
          freight_value?: number
          id?: string
          is_own_fleet?: boolean | null
          manifest_code?: string
          manifest_number?: number | null
          observation?: string | null
          paid_at?: string | null
          per_km_value?: number | null
          provider_invoice_id?: string | null
          scheduled_date?: string
          status?: string
          tenant_id?: string | null
          total_value?: number | null
          total_weight?: number | null
          updated_at?: string
          vehicle_plate?: string | null
          vehicle_type?: string | null
          had_occurrence?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "manifests_company_vehicle_id_fkey"
            columns: ["company_vehicle_id"]
            isOneToOne: false
            referencedRelation: "company_vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manifests_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manifests_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "vw_drivers_operational"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manifests_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "vw_drivers_with_gps_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manifests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      occurrence_reasons: {
        Row: {
          active: boolean
          code: string
          created_at: string
          id: string
          label: string
          sort_order: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          id?: string
          label: string
          sort_order?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          id?: string
          label?: string
          sort_order?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      occurrences: {
        Row: {
          created_at: string | null
          description: string | null
          driver_id: string
          driver_name: string
          id: string
          latitude: number | null
          longitude: number | null
          photos: string[] | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string | null
          status: string | null
          tenant_id: string | null
          title: string
          type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          driver_id: string
          driver_name: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          photos?: string[] | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string | null
          status?: string | null
          tenant_id?: string | null
          title: string
          type: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          driver_id?: string
          driver_name?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          photos?: string[] | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string | null
          status?: string | null
          tenant_id?: string | null
          title?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "occurrences_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "occurrences_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "vw_drivers_operational"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "occurrences_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "vw_drivers_with_gps_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "occurrences_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_history: {
        Row: {
          amount: number | null
          created_at: string
          cycle: string | null
          due_date: string | null
          id: string
          notes: string | null
          payment_date: string
          recorded_by: string | null
          tenant_id: string
        }
        Insert: {
          amount?: number | null
          created_at?: string
          cycle?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          payment_date?: string
          recorded_by?: string | null
          tenant_id: string
        }
        Update: {
          amount?: number | null
          created_at?: string
          cycle?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          payment_date?: string
          recorded_by?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_history_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_admins: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          name: string
          tenant_id: string | null
          updated_at: string | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
          name: string
          tenant_id?: string | null
          updated_at?: string | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          name?: string
          tenant_id?: string | null
          updated_at?: string | null
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_invoices: {
        Row: {
          amount: number
          carrier_id: string | null
          created_at: string
          driver_id: string | null
          expected_amount: number
          file_name: string | null
          file_path: string
          id: string
          invoice_number: string
          issue_date: string | null
          paid_at: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_by: string | null
          tenant_id: string
          updated_at: string
          work_dates: string[]
        }
        Insert: {
          amount: number
          carrier_id?: string | null
          created_at?: string
          driver_id?: string | null
          expected_amount?: number
          file_name?: string | null
          file_path: string
          id?: string
          invoice_number: string
          issue_date?: string | null
          paid_at?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_by?: string | null
          tenant_id: string
          updated_at?: string
          work_dates: string[]
        }
        Update: {
          amount?: number
          carrier_id?: string | null
          created_at?: string
          driver_id?: string | null
          expected_amount?: number
          file_name?: string | null
          file_path?: string
          id?: string
          invoice_number?: string
          issue_date?: string | null
          paid_at?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_by?: string | null
          tenant_id?: string
          updated_at?: string
          work_dates?: string[]
        }
        Relationships: []
      }
      settlement_audit_logs: {
        Row: {
          action_type: string
          id: string
          ip_address: string | null
          new_status: string | null
          notes: string | null
          performed_at: string
          performed_by: string | null
          previous_status: string | null
          settlement_id: string | null
          tenant_id: string | null
        }
        Insert: {
          action_type: string
          id?: string
          ip_address?: string | null
          new_status?: string | null
          notes?: string | null
          performed_at?: string
          performed_by?: string | null
          previous_status?: string | null
          settlement_id?: string | null
          tenant_id?: string | null
        }
        Update: {
          action_type?: string
          id?: string
          ip_address?: string | null
          new_status?: string | null
          notes?: string | null
          performed_at?: string
          performed_by?: string | null
          previous_status?: string | null
          settlement_id?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "settlement_audit_logs_settlement_id_fkey"
            columns: ["settlement_id"]
            isOneToOne: false
            referencedRelation: "settlements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlement_audit_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      settlement_items: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          description: string
          id: string
          is_deduction: boolean
          item_type: string
          manifest_id: string | null
          settlement_id: string
          tenant_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          is_deduction?: boolean
          item_type: string
          manifest_id?: string | null
          settlement_id: string
          tenant_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          is_deduction?: boolean
          item_type?: string
          manifest_id?: string | null
          settlement_id?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "settlement_items_manifest_id_fkey"
            columns: ["manifest_id"]
            isOneToOne: false
            referencedRelation: "manifests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlement_items_settlement_id_fkey"
            columns: ["settlement_id"]
            isOneToOne: false
            referencedRelation: "settlements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlement_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      settlements: {
        Row: {
          created_at: string
          driver_id: string
          driver_name: string
          id: string
          net_amount: number | null
          observation: string | null
          paid_amount: number | null
          paid_at: string | null
          paid_by: string | null
          payment_method: string | null
          payment_reference: string | null
          period_end: string | null
          period_start: string
          status: string
          tenant_id: string | null
          total_additions: number
          total_deductions: number
          total_freight: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          driver_id: string
          driver_name: string
          id?: string
          net_amount?: number | null
          observation?: string | null
          paid_amount?: number | null
          paid_at?: string | null
          paid_by?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          period_end?: string | null
          period_start: string
          status?: string
          tenant_id?: string | null
          total_additions?: number
          total_deductions?: number
          total_freight?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          driver_id?: string
          driver_name?: string
          id?: string
          net_amount?: number | null
          observation?: string | null
          paid_amount?: number | null
          paid_at?: string | null
          paid_by?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          period_end?: string | null
          period_start?: string
          status?: string
          tenant_id?: string | null
          total_additions?: number
          total_deductions?: number
          total_freight?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "settlements_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlements_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "vw_drivers_operational"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlements_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "vw_drivers_with_gps_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      system_users: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string | null
          id: string
          name: string | null
          role: string
          tenant_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string | null
          role?: string
          tenant_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string | null
          role?: string
          tenant_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "system_users_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_memberships: {
        Row: {
          created_at: string
          id: string
          role: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: string
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_memberships_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          auto_block_days: number | null
          bairro: string | null
          cep: string | null
          cidade: string | null
          cnpj: string
          contract_start_date: string | null
          created_at: string
          financial_status: string | null
          id: string
          latitude: number | null
          logo_url: string | null
          logradouro: string | null
          longitude: number | null
          next_due_date: string | null
          numero: string | null
          payment_cycle: string | null
          pays_only_with_invoice: boolean | null
          plan: string
          plan_started_at: string | null
          razao_social: string
          status: string
          telefone: string | null
          uf: string | null
          updated_at: string
          billing_document: string | null
          billing_document_type: string | null
          converted_at: string | null
          signup_visitor_id: string | null
          trial_ends_at: string | null
          trial_extensions: number
          trial_started_at: string | null
        }
        Insert: {
          auto_block_days?: number | null
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj: string
          contract_start_date?: string | null
          created_at?: string
          financial_status?: string | null
          id?: string
          latitude?: number | null
          logo_url?: string | null
          logradouro?: string | null
          longitude?: number | null
          next_due_date?: string | null
          numero?: string | null
          payment_cycle?: string | null
          pays_only_with_invoice?: boolean | null
          plan?: string
          plan_started_at?: string | null
          razao_social: string
          status?: string
          telefone?: string | null
          uf?: string | null
          updated_at?: string
          billing_document?: string | null
          billing_document_type?: string | null
          converted_at?: string | null
          signup_visitor_id?: string | null
          trial_ends_at?: string | null
          trial_extensions?: number
          trial_started_at?: string | null
        }
        Update: {
          auto_block_days?: number | null
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string
          contract_start_date?: string | null
          created_at?: string
          financial_status?: string | null
          id?: string
          latitude?: number | null
          logo_url?: string | null
          logradouro?: string | null
          longitude?: number | null
          next_due_date?: string | null
          numero?: string | null
          payment_cycle?: string | null
          pays_only_with_invoice?: boolean | null
          plan?: string
          plan_started_at?: string | null
          razao_social?: string
          status?: string
          telefone?: string | null
          uf?: string | null
          updated_at?: string
          billing_document?: string | null
          billing_document_type?: string | null
          converted_at?: string | null
          signup_visitor_id?: string | null
          trial_ends_at?: string | null
          trial_extensions?: number
          trial_started_at?: string | null
        }
        Relationships: []
      }
      trial_registrations: {
        Row: {
          created_at: string
          document: string
          document_type: string
          email: string | null
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          document: string
          document_type: string
          email?: string | null
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          document?: string
          document_type?: string
          email?: string | null
          tenant_id?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      vw_driver_occurrence_stats: {
        Row: {
          critical_count: number | null
          driver_id: string | null
          driver_name: string | null
          last_occurrence_date: string | null
          open_count: number | null
          total_occurrences: number | null
        }
        Relationships: [
          {
            foreignKeyName: "occurrences_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "occurrences_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "vw_drivers_operational"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "occurrences_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "vw_drivers_with_gps_status"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_drivers_operational: {
        Row: {
          avatar: string | null
          created_at: string | null
          current_delay: number | null
          daily_sla: number | null
          deliveries_completed: number | null
          finished_time: string | null
          gps_signal_status: string | null
          id: string | null
          individual_sla: number | null
          is_own_fleet: boolean | null
          last_gps_update: string | null
          name: string | null
          photo_url: string | null
          status: string | null
          total_deliveries: number | null
          updated_at: string | null
          vehicle_plate: string | null
          vehicle_type: string | null
        }
        Insert: {
          avatar?: string | null
          created_at?: string | null
          current_delay?: number | null
          daily_sla?: number | null
          deliveries_completed?: number | null
          finished_time?: string | null
          gps_signal_status?: string | null
          id?: string | null
          individual_sla?: number | null
          is_own_fleet?: boolean | null
          last_gps_update?: string | null
          name?: string | null
          photo_url?: string | null
          status?: string | null
          total_deliveries?: number | null
          updated_at?: string | null
          vehicle_plate?: string | null
          vehicle_type?: string | null
        }
        Update: {
          avatar?: string | null
          created_at?: string | null
          current_delay?: number | null
          daily_sla?: number | null
          deliveries_completed?: number | null
          finished_time?: string | null
          gps_signal_status?: string | null
          id?: string | null
          individual_sla?: number | null
          is_own_fleet?: boolean | null
          last_gps_update?: string | null
          name?: string | null
          photo_url?: string | null
          status?: string | null
          total_deliveries?: number | null
          updated_at?: string | null
          vehicle_plate?: string | null
          vehicle_type?: string | null
        }
        Relationships: []
      }
      vw_drivers_with_gps_status: {
        Row: {
          battery_level: number | null
          computed_gps_status: string | null
          gps_signal_status: string | null
          id: string | null
          last_gps_update: string | null
          latitude: number | null
          longitude: number | null
          name: string | null
          phone: string | null
          photo_url: string | null
          speed: number | null
          status: string | null
          vehicle_plate: string | null
          vehicle_type: string | null
        }
        Relationships: []
      }
      vw_invoices_for_drivers: {
        Row: {
          access_key: string | null
          address_city: string | null
          address_neighborhood: string | null
          address_state: string | null
          delivered_at: string | null
          driver_id: string | null
          id: string | null
          imported_at: string | null
          latitude: number | null
          longitude: number | null
          manifest_id: string | null
          nfe_number: string | null
          observation: string | null
          occurrence_type: string | null
          receiver_name: string | null
          recipient_name: string | null
          regiao_logistica: string | null
          status: string | null
          total_value: number | null
          total_weight: number | null
          updated_at: string | null
          volume_quantity: number | null
        }
        Insert: {
          access_key?: string | null
          address_city?: string | null
          address_neighborhood?: string | null
          address_state?: string | null
          delivered_at?: string | null
          driver_id?: string | null
          id?: string | null
          imported_at?: string | null
          latitude?: number | null
          longitude?: number | null
          manifest_id?: string | null
          nfe_number?: string | null
          observation?: string | null
          occurrence_type?: string | null
          receiver_name?: string | null
          recipient_name?: string | null
          regiao_logistica?: string | null
          status?: string | null
          total_value?: number | null
          total_weight?: number | null
          updated_at?: string | null
          volume_quantity?: number | null
        }
        Update: {
          access_key?: string | null
          address_city?: string | null
          address_neighborhood?: string | null
          address_state?: string | null
          delivered_at?: string | null
          driver_id?: string | null
          id?: string | null
          imported_at?: string | null
          latitude?: number | null
          longitude?: number | null
          manifest_id?: string | null
          nfe_number?: string | null
          observation?: string | null
          occurrence_type?: string | null
          receiver_name?: string | null
          recipient_name?: string | null
          regiao_logistica?: string | null
          status?: string | null
          total_value?: number | null
          total_weight?: number | null
          updated_at?: string | null
          volume_quantity?: number | null
        }
        Relationships: []
      }
      vw_occurrences_with_driver: {
        Row: {
          created_at: string | null
          description: string | null
          driver_id: string | null
          driver_name: string | null
          driver_phone: string | null
          driver_photo: string | null
          id: string | null
          latitude: number | null
          longitude: number | null
          photos: string[] | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string | null
          status: string | null
          title: string | null
          type: string | null
          updated_at: string | null
          vehicle_plate: string | null
          vehicle_type: string | null
        }
        Relationships: [
          {
            foreignKeyName: "occurrences_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "occurrences_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "vw_drivers_operational"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "occurrences_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "vw_drivers_with_gps_status"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      can_admin_tenant: {
        Args: { p_tenant_id: string; p_user_id?: string }
        Returns: boolean
      }
      can_view_driver_documents: { Args: { p_user_id?: string }; Returns: boolean }
      extend_tenant_trial: {
        Args: { p_days?: number; p_tenant_id: string }
        Returns: Json
      }
      get_funnel_summary: {
        Args: { p_from: string; p_to: string }
        Returns: Json
      }
      get_my_tenant_access: { Args: never; Returns: Json }
      record_billing_notice: {
        Args: {
          p_acknowledged?: boolean
          p_notice_type: string
          p_reference_date: string
        }
        Returns: undefined
      }
      submit_provider_invoice: {
        Args: {
          p_amount: number
          p_carrier_id: string | null
          p_driver_id: string | null
          p_file_name: string | null
          p_file_path: string
          p_id: string | null
          p_invoice_number: string
          p_issue_date: string | null
          p_work_dates: string[]
        }
        Returns: string
      }
      review_provider_invoice: {
        Args: { p_approve: boolean; p_id: string; p_note?: string | null }
        Returns: string
      }
      delete_provider_invoice: { Args: { p_id: string }; Returns: undefined }
      provider_invoice_days: {
        Args: {
          p_carrier_id: string | null
          p_driver_id: string | null
          p_from: string
          p_invoice_id?: string | null
          p_to: string
        }
        Returns: {
          freight: number
          manifests: number
          other_invoice: string | null
          paid: number
          payable: number
          work_date: string
        }[]
      }
      get_my_payment_profile: { Args: never; Returns: Json }
      register_driver_arrival: {
        Args: {
          p_invoice_id: string
          p_latitude: number
          p_longitude: number
          p_radius_m?: number
        }
        Returns: Json
      }
      delete_manifest: { Args: { p_manifest_id: string }; Returns: Json }
      finalize_manifest: { Args: { p_manifest_id: string }; Returns: Json }
      set_manifest_route_order: {
        Args: { p_invoice_ids: string[]; p_manifest_id: string }
        Returns: number
      }
      set_user_role: {
        Args: {
          p_role: Database["public"]["Enums"]["app_role"]
          p_user_id: string
        }
        Returns: Json
      }
      tenant_access_state: { Args: { p_tenant_id: string }; Returns: string }
      tenant_has_access: { Args: { p_tenant_id: string }; Returns: boolean }
      track_funnel_event: {
        Args: {
          p_event: string
          p_metadata?: Json
          p_path?: string
          p_visitor_id: string
        }
        Returns: undefined
      }
      calculate_regiao_logistica: {
        Args: { cep_input: string }
        Returns: string
      }
      check_plan_limit: {
        Args: { p_resource: string; p_tenant_id: string }
        Returns: Json
      }
      cleanup_ghost_drivers: { Args: never; Returns: undefined }
      create_driver_complete:
        | {
            Args: {
              p_cpf?: string
              p_email: string
              p_name: string
              p_phone?: string
              p_vehicle_plate?: string
              p_vehicle_type?: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_cpf?: string
              p_email: string
              p_name: string
              p_password: string
              p_phone?: string
              p_vehicle_plate?: string
              p_vehicle_type?: string
            }
            Returns: Json
          }
      create_driver_with_auth: {
        Args: {
          p_cpf?: string
          p_email: string
          p_name: string
          p_password: string
          p_phone?: string
          p_vehicle_plate?: string
        }
        Returns: Json
      }
      create_manifest_with_invoices: {
        Args: {
          p_company_vehicle_id?: string
          p_driver_cpf?: string
          p_driver_id: string
          p_driver_name: string
          p_estimated_distance?: number
          p_freight_type?: string
          p_freight_value?: number
          p_invoice_ids?: string[]
          p_is_own_fleet?: boolean
          p_observation?: string
          p_per_km_value?: number
          p_scheduled_date?: string
          p_vehicle_plate?: string
          p_vehicle_type?: string
        }
        Returns: Json
      }
      current_user_id: { Args: never; Returns: string }
      delete_driver_account: {
        Args: { target_user_id: string }
        Returns: undefined
      }
      delete_driver_complete: { Args: { p_driver_id: string }; Returns: Json }
      delete_user_complete: { Args: { p_user_id: string }; Returns: Json }
      delete_user_completely: { Args: { user_id: string }; Returns: undefined }
      get_active_fleet_positions: {
        Args: never
        Returns: {
          battery_level: number
          driver_id: string
          driver_name: string
          driver_photo: string
          heading: number
          id: string
          last_update: string
          latitude: number
          longitude: number
          speed: number
          vehicle_plate: string
          vehicle_type: string
        }[]
      }
      get_driver_active_manifest: {
        Args: never
        Returns: {
          completed_deliveries: number
          deliveries: Json
          manifest_code: string
          manifest_id: string
          manifest_status: string
          pending_deliveries: number
          total_deliveries: number
        }[]
      }
      get_driver_tenant_id: { Args: { p_user_id: string }; Returns: string }
      get_invoice_delivery_address: {
        Args: { p_invoice_id: string }
        Returns: Json
      }
      get_my_current_manifest: {
        Args: never
        Returns: {
          completed_deliveries: number
          deliveries: Json
          manifest_id: string
          status: string
          total_deliveries: number
        }[]
      }
      get_operational_drivers: {
        Args: never
        Returns: {
          avatar: string
          created_at: string
          current_delay: number
          daily_sla: number
          deliveries_completed: number
          finished_time: string
          id: string
          individual_sla: number
          is_own_fleet: boolean
          name: string
          status: string
          total_deliveries: number
          updated_at: string
          vehicle_plate: string
          vehicle_type: string
        }[]
      }
      get_operational_profiles: {
        Args: never
        Returns: {
          avatar_url: string
          created_at: string
          id: string
          name: string
          updated_at: string
        }[]
      }
      get_plan_limits: { Args: { p_plan: string }; Returns: Json }
      get_upload_url: {
        Args: { bucket_name: string; file_path: string }
        Returns: string
      }
      get_user_full_name: { Args: { user_id: string }; Returns: string }
      get_user_tenant_id:
        | { Args: never; Returns: string }
        | { Args: { p_user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin:
        | { Args: never; Returns: boolean }
        | { Args: { user_id: string }; Returns: boolean }
      is_admin_user: { Args: never; Returns: boolean }
      is_authenticated: { Args: never; Returns: boolean }
      is_driver_email:
        | {
            Args: { email: string }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.is_driver_email(email => text), public.is_driver_email(email => varchar). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
        | {
            Args: { email: string }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.is_driver_email(email => text), public.is_driver_email(email => varchar). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
      is_platform_admin:
        | { Args: never; Returns: boolean }
        | { Args: { p_user_id: string }; Returns: boolean }
      mark_inactive_positions: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "fleet_manager" | "dispatcher" | "viewer"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "fleet_manager", "dispatcher", "viewer"],
    },
  },
} as const
