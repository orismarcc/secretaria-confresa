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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_counters: {
        Row: {
          key: string
          value: number
        }
        Insert: {
          key: string
          value?: number
        }
        Update: {
          key?: string
          value?: number
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          changed_at: string
          changed_fields: string[] | null
          id: string
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          table_name: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          changed_at?: string
          changed_fields?: string[] | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          changed_at?: string
          changed_fields?: string[] | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string
        }
        Relationships: []
      }
      backup_localizacao_produtor: {
        Row: {
          alvo: string
          alvo_id: string
          backed_up_at: string
          old_latitude: number | null
          old_longitude: number | null
        }
        Insert: {
          alvo: string
          alvo_id: string
          backed_up_at?: string
          old_latitude?: number | null
          old_longitude?: number | null
        }
        Update: {
          alvo?: string
          alvo_id?: string
          backed_up_at?: string
          old_latitude?: number | null
          old_longitude?: number | null
        }
        Relationships: []
      }
      backup_pc_area_05: {
        Row: {
          backed_up_at: string
          old_worked_area: number | null
          service_id: string
        }
        Insert: {
          backed_up_at?: string
          old_worked_area?: number | null
          service_id: string
        }
        Update: {
          backed_up_at?: string
          old_worked_area?: number | null
          service_id?: string
        }
        Relationships: []
      }
      backup_pc_xavante_antoniel: {
        Row: {
          backed_up_at: string
          old_machinery_id: string | null
          old_operator_id: string | null
          service_id: string
        }
        Insert: {
          backed_up_at?: string
          old_machinery_id?: string | null
          old_operator_id?: string | null
          service_id: string
        }
        Update: {
          backed_up_at?: string
          old_machinery_id?: string | null
          old_operator_id?: string | null
          service_id?: string
        }
        Relationships: []
      }
      backup_unificacao_produtores: {
        Row: {
          desfeito_em: string | null
          id: string
          manter_id: string
          movidos: Json
          removido: Json
          unificado_em: string
          unificado_por: string | null
        }
        Insert: {
          desfeito_em?: string | null
          id?: string
          manter_id: string
          movidos: Json
          removido: Json
          unificado_em?: string
          unificado_por?: string | null
        }
        Update: {
          desfeito_em?: string | null
          id?: string
          manter_id?: string
          movidos?: Json
          removido?: Json
          unificado_em?: string
          unificado_por?: string | null
        }
        Relationships: []
      }
      condutores: {
        Row: {
          cnh_categoria: string | null
          cnh_numero: string | null
          cnh_validade: string | null
          cpf: string | null
          created_at: string
          id: string
          is_active: boolean
          matricula: string | null
          name: string
          operator_id: string | null
          telefone: string | null
          updated_at: string
        }
        Insert: {
          cnh_categoria?: string | null
          cnh_numero?: string | null
          cnh_validade?: string | null
          cpf?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          matricula?: string | null
          name: string
          operator_id?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          cnh_categoria?: string | null
          cnh_numero?: string | null
          cnh_validade?: string | null
          cpf?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          matricula?: string | null
          name?: string
          operator_id?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      deliveries: {
        Row: {
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          delivery_date_end: string
          delivery_date_start: string
          demand_type_id: string
          id: string
          notes: string | null
          producer_id: string
          quantity: number
          settlement_id: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          delivery_date_end: string
          delivery_date_start: string
          demand_type_id: string
          id?: string
          notes?: string | null
          producer_id: string
          quantity: number
          settlement_id?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          delivery_date_end?: string
          delivery_date_start?: string
          demand_type_id?: string
          id?: string
          notes?: string | null
          producer_id?: string
          quantity?: number
          settlement_id?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_demand_type_id_fkey"
            columns: ["demand_type_id"]
            isOneToOne: false
            referencedRelation: "demand_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_producer_id_fkey"
            columns: ["producer_id"]
            isOneToOne: false
            referencedRelation: "producers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_producer_id_fkey"
            columns: ["producer_id"]
            isOneToOne: false
            referencedRelation: "producers_cpf_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_settlement_id_fkey"
            columns: ["settlement_id"]
            isOneToOne: false
            referencedRelation: "settlements"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_items: {
        Row: {
          created_at: string
          delivery_id: string
          id: string
          lot_id: string
          quantity: number
        }
        Insert: {
          created_at?: string
          delivery_id: string
          id?: string
          lot_id: string
          quantity: number
        }
        Update: {
          created_at?: string
          delivery_id?: string
          id?: string
          lot_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "delivery_items_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_items_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "delivery_lot_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_items_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "delivery_lots"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_lots: {
        Row: {
          created_at: string
          created_by: string | null
          demand_type_id: string
          id: string
          initial_quantity: number
          is_active: boolean
          lot_date: string | null
          name: string
          notes: string | null
          responsible_technician_id: string | null
          supplier: string | null
          unit: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          demand_type_id: string
          id?: string
          initial_quantity: number
          is_active?: boolean
          lot_date?: string | null
          name: string
          notes?: string | null
          responsible_technician_id?: string | null
          supplier?: string | null
          unit?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          demand_type_id?: string
          id?: string
          initial_quantity?: number
          is_active?: boolean
          lot_date?: string | null
          name?: string
          notes?: string | null
          responsible_technician_id?: string | null
          supplier?: string | null
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_lots_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_lots_demand_type_id_fkey"
            columns: ["demand_type_id"]
            isOneToOne: false
            referencedRelation: "demand_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_lots_responsible_technician_id_fkey"
            columns: ["responsible_technician_id"]
            isOneToOne: false
            referencedRelation: "responsible_technicians"
            referencedColumns: ["id"]
          },
        ]
      }
      demand_types: {
        Row: {
          category: string | null
          charges_fuel_by_distance: boolean | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          operation_type: string | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          charges_fuel_by_distance?: boolean | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          operation_type?: string | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          charges_fuel_by_distance?: boolean | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          operation_type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      driver_licenses: {
        Row: {
          categoria: string | null
          created_at: string
          numero: string | null
          operator_id: string
          updated_at: string
          validade: string | null
        }
        Insert: {
          categoria?: string | null
          created_at?: string
          numero?: string | null
          operator_id: string
          updated_at?: string
          validade?: string | null
        }
        Update: {
          categoria?: string | null
          created_at?: string
          numero?: string | null
          operator_id?: string
          updated_at?: string
          validade?: string | null
        }
        Relationships: []
      }
      fleet_documents: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          doc_type: string
          file_path: string | null
          id: string
          machinery_id: string
          responsavel: string | null
          updated_at: string
          validade: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          doc_type: string
          file_path?: string | null
          id?: string
          machinery_id: string
          responsavel?: string | null
          updated_at?: string
          validade?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          doc_type?: string
          file_path?: string | null
          id?: string
          machinery_id?: string
          responsavel?: string | null
          updated_at?: string
          validade?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fleet_documents_machinery_id_fkey"
            columns: ["machinery_id"]
            isOneToOne: false
            referencedRelation: "machinery"
            referencedColumns: ["id"]
          },
        ]
      }
      fuel_usage: {
        Row: {
          created_at: string
          created_by: string | null
          fuel_type: string
          id: string
          liters: number
          reference_month: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          fuel_type: string
          id?: string
          liters?: number
          reference_month: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          fuel_type?: string
          id?: string
          liters?: number
          reference_month?: string
          updated_at?: string
        }
        Relationships: []
      }
      glebas: {
        Row: {
          created_at: string | null
          id: string
          name: string
          settlement_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          settlement_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          settlement_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "glebas_settlement_id_fkey"
            columns: ["settlement_id"]
            isOneToOne: false
            referencedRelation: "settlements"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          created_at: string | null
          id: string
          name: string
          settlement_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          settlement_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          settlement_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "locations_settlement_id_fkey"
            columns: ["settlement_id"]
            isOneToOne: false
            referencedRelation: "settlements"
            referencedColumns: ["id"]
          },
        ]
      }
      machinery: {
        Row: {
          chassis: string | null
          created_at: string | null
          fuel_type: string | null
          id: string
          is_active: boolean
          kind: string
          name: string
          patrimony_number: string
          updated_at: string
          vinculo: string
          vinculo_fim: string | null
          vinculo_inicio: string | null
          vinculo_origem: string | null
        }
        Insert: {
          chassis?: string | null
          created_at?: string | null
          fuel_type?: string | null
          id?: string
          is_active?: boolean
          kind?: string
          name: string
          patrimony_number: string
          updated_at?: string
          vinculo?: string
          vinculo_fim?: string | null
          vinculo_inicio?: string | null
          vinculo_origem?: string | null
        }
        Update: {
          chassis?: string | null
          created_at?: string | null
          fuel_type?: string | null
          id?: string
          is_active?: boolean
          kind?: string
          name?: string
          patrimony_number?: string
          updated_at?: string
          vinculo?: string
          vinculo_fim?: string | null
          vinculo_inicio?: string | null
          vinculo_origem?: string | null
        }
        Relationships: []
      }
      machinery_maintenance: {
        Row: {
          cost: number | null
          created_at: string
          created_by: string | null
          description: string
          ended_at: string | null
          hour_meter: number | null
          id: string
          machinery_id: string
          operator_id: string | null
          started_at: string
          updated_at: string
        }
        Insert: {
          cost?: number | null
          created_at?: string
          created_by?: string | null
          description: string
          ended_at?: string | null
          hour_meter?: number | null
          id?: string
          machinery_id: string
          operator_id?: string | null
          started_at: string
          updated_at?: string
        }
        Update: {
          cost?: number | null
          created_at?: string
          created_by?: string | null
          description?: string
          ended_at?: string | null
          hour_meter?: number | null
          id?: string
          machinery_id?: string
          operator_id?: string | null
          started_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "machinery_maintenance_machinery_id_fkey"
            columns: ["machinery_id"]
            isOneToOne: false
            referencedRelation: "machinery"
            referencedColumns: ["id"]
          },
        ]
      }
      machinery_refuels: {
        Row: {
          created_at: string
          created_by: string | null
          fuel_type: string | null
          hour_meter: number | null
          id: string
          liters: number
          machinery_id: string
          note: string | null
          price_per_liter: number | null
          receipt_path: string | null
          refueled_at: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          fuel_type?: string | null
          hour_meter?: number | null
          id?: string
          liters: number
          machinery_id: string
          note?: string | null
          price_per_liter?: number | null
          receipt_path?: string | null
          refueled_at?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          fuel_type?: string | null
          hour_meter?: number | null
          id?: string
          liters?: number
          machinery_id?: string
          note?: string | null
          price_per_liter?: number | null
          receipt_path?: string | null
          refueled_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "machinery_refuels_machinery_id_fkey"
            columns: ["machinery_id"]
            isOneToOne: false
            referencedRelation: "machinery"
            referencedColumns: ["id"]
          },
        ]
      }
      multas: {
        Row: {
          auto_infracao: string | null
          condutor_id: string | null
          condutor_identificado: boolean
          created_at: string
          created_by: string | null
          data: string | null
          data_limite_recurso: string | null
          file_path: string | null
          horario: string | null
          id: string
          infracao: string | null
          local: string | null
          machinery_id: string
          observacao: string | null
          orgao_autuador: string | null
          placa: string | null
          pontos: number | null
          status: string
          termo_id: string | null
          updated_at: string
          valor: number | null
          viagem_id: string | null
        }
        Insert: {
          auto_infracao?: string | null
          condutor_id?: string | null
          condutor_identificado?: boolean
          created_at?: string
          created_by?: string | null
          data?: string | null
          data_limite_recurso?: string | null
          file_path?: string | null
          horario?: string | null
          id?: string
          infracao?: string | null
          local?: string | null
          machinery_id: string
          observacao?: string | null
          orgao_autuador?: string | null
          placa?: string | null
          pontos?: number | null
          status?: string
          termo_id?: string | null
          updated_at?: string
          valor?: number | null
          viagem_id?: string | null
        }
        Update: {
          auto_infracao?: string | null
          condutor_id?: string | null
          condutor_identificado?: boolean
          created_at?: string
          created_by?: string | null
          data?: string | null
          data_limite_recurso?: string | null
          file_path?: string | null
          horario?: string | null
          id?: string
          infracao?: string | null
          local?: string | null
          machinery_id?: string
          observacao?: string | null
          orgao_autuador?: string | null
          placa?: string | null
          pontos?: number | null
          status?: string
          termo_id?: string | null
          updated_at?: string
          valor?: number | null
          viagem_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "multas_condutor_id_fkey"
            columns: ["condutor_id"]
            isOneToOne: false
            referencedRelation: "condutores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "multas_machinery_id_fkey"
            columns: ["machinery_id"]
            isOneToOne: false
            referencedRelation: "machinery"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "multas_termo_id_fkey"
            columns: ["termo_id"]
            isOneToOne: false
            referencedRelation: "termos_responsabilidade"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "multas_viagem_id_fkey"
            columns: ["viagem_id"]
            isOneToOne: false
            referencedRelation: "viagens"
            referencedColumns: ["id"]
          },
        ]
      }
      operator_demand_types: {
        Row: {
          created_at: string | null
          demand_type_id: string
          operator_id: string
        }
        Insert: {
          created_at?: string | null
          demand_type_id: string
          operator_id: string
        }
        Update: {
          created_at?: string | null
          demand_type_id?: string
          operator_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "operator_demand_types_demand_type_id_fkey"
            columns: ["demand_type_id"]
            isOneToOne: false
            referencedRelation: "demand_types"
            referencedColumns: ["id"]
          },
        ]
      }
      operator_glebas: {
        Row: {
          created_at: string | null
          gleba_id: string
          operator_id: string
        }
        Insert: {
          created_at?: string | null
          gleba_id: string
          operator_id: string
        }
        Update: {
          created_at?: string | null
          gleba_id?: string
          operator_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "operator_glebas_gleba_id_fkey"
            columns: ["gleba_id"]
            isOneToOne: false
            referencedRelation: "glebas"
            referencedColumns: ["id"]
          },
        ]
      }
      operator_machinery: {
        Row: {
          created_at: string | null
          machinery_id: string
          operator_id: string
        }
        Insert: {
          created_at?: string | null
          machinery_id: string
          operator_id: string
        }
        Update: {
          created_at?: string | null
          machinery_id?: string
          operator_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "operator_machinery_machinery_id_fkey"
            columns: ["machinery_id"]
            isOneToOne: false
            referencedRelation: "machinery"
            referencedColumns: ["id"]
          },
        ]
      }
      operator_settlements: {
        Row: {
          created_at: string | null
          operator_id: string
          settlement_id: string
        }
        Insert: {
          created_at?: string | null
          operator_id: string
          settlement_id: string
        }
        Update: {
          created_at?: string | null
          operator_id?: string
          settlement_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "operator_settlements_settlement_id_fkey"
            columns: ["settlement_id"]
            isOneToOne: false
            referencedRelation: "settlements"
            referencedColumns: ["id"]
          },
        ]
      }
      patrimony: {
        Row: {
          acquisition_date: string | null
          category: string | null
          chassis: string | null
          condition: string | null
          created_at: string | null
          description: string | null
          id: string
          image_url: string | null
          image_url_2: string | null
          image_url_3: string | null
          is_active: boolean
          latitude: number | null
          location: string | null
          longitude: number | null
          name: string
          notes: string | null
          patrimony_number: string
          patrimony_number_state: string | null
          responsible_name: string | null
          responsible_phone: string | null
          updated_at: string
          value: number | null
          written_off: boolean
        }
        Insert: {
          acquisition_date?: string | null
          category?: string | null
          chassis?: string | null
          condition?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          image_url_2?: string | null
          image_url_3?: string | null
          is_active?: boolean
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          name: string
          notes?: string | null
          patrimony_number: string
          patrimony_number_state?: string | null
          responsible_name?: string | null
          responsible_phone?: string | null
          updated_at?: string
          value?: number | null
          written_off?: boolean
        }
        Update: {
          acquisition_date?: string | null
          category?: string | null
          chassis?: string | null
          condition?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          image_url_2?: string | null
          image_url_3?: string | null
          is_active?: boolean
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          name?: string
          notes?: string | null
          patrimony_number?: string
          patrimony_number_state?: string | null
          responsible_name?: string | null
          responsible_phone?: string | null
          updated_at?: string
          value?: number | null
          written_off?: boolean
        }
        Relationships: []
      }
      patrimony_transfers: {
        Row: {
          condition: string | null
          created_at: string | null
          created_by: string | null
          id: string
          location: string | null
          notes: string | null
          patrimony_id: string
          responsible_name: string | null
          responsible_phone: string | null
          transferred_at: string
        }
        Insert: {
          condition?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          location?: string | null
          notes?: string | null
          patrimony_id: string
          responsible_name?: string | null
          responsible_phone?: string | null
          transferred_at: string
        }
        Update: {
          condition?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          location?: string | null
          notes?: string | null
          patrimony_id?: string
          responsible_name?: string | null
          responsible_phone?: string | null
          transferred_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patrimony_transfers_patrimony_id_fkey"
            columns: ["patrimony_id"]
            isOneToOne: false
            referencedRelation: "patrimony"
            referencedColumns: ["id"]
          },
        ]
      }
      producer_demands: {
        Row: {
          created_at: string | null
          demand_type_id: string
          id: string
          producer_id: string
        }
        Insert: {
          created_at?: string | null
          demand_type_id: string
          id?: string
          producer_id: string
        }
        Update: {
          created_at?: string | null
          demand_type_id?: string
          id?: string
          producer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "producer_demands_demand_type_id_fkey"
            columns: ["demand_type_id"]
            isOneToOne: false
            referencedRelation: "demand_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producer_demands_producer_id_fkey"
            columns: ["producer_id"]
            isOneToOne: false
            referencedRelation: "producers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producer_demands_producer_id_fkey"
            columns: ["producer_id"]
            isOneToOne: false
            referencedRelation: "producers_cpf_view"
            referencedColumns: ["id"]
          },
        ]
      }
      producer_properties: {
        Row: {
          created_at: string
          gleba_id: string | null
          id: string
          latitude: number | null
          location_name: string | null
          longitude: number | null
          name: string | null
          producer_id: string
          settlement_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          gleba_id?: string | null
          id?: string
          latitude?: number | null
          location_name?: string | null
          longitude?: number | null
          name?: string | null
          producer_id: string
          settlement_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          gleba_id?: string | null
          id?: string
          latitude?: number | null
          location_name?: string | null
          longitude?: number | null
          name?: string | null
          producer_id?: string
          settlement_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "producer_properties_gleba_id_fkey"
            columns: ["gleba_id"]
            isOneToOne: false
            referencedRelation: "glebas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producer_properties_producer_id_fkey"
            columns: ["producer_id"]
            isOneToOne: false
            referencedRelation: "producers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producer_properties_producer_id_fkey"
            columns: ["producer_id"]
            isOneToOne: false
            referencedRelation: "producers_cpf_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producer_properties_settlement_id_fkey"
            columns: ["settlement_id"]
            isOneToOne: false
            referencedRelation: "settlements"
            referencedColumns: ["id"]
          },
        ]
      }
      producers: {
        Row: {
          caf: string | null
          cpf: string
          cpf_encrypted: string | null
          created_at: string | null
          dap_cap: string | null
          gleba_id: string | null
          id: string
          latitude: number | null
          location_id: string | null
          location_name: string | null
          longitude: number | null
          name: string
          phone: string | null
          property_name: string | null
          property_size: number | null
          settlement_id: string | null
          updated_at: string
        }
        Insert: {
          caf?: string | null
          cpf: string
          cpf_encrypted?: string | null
          created_at?: string | null
          dap_cap?: string | null
          gleba_id?: string | null
          id?: string
          latitude?: number | null
          location_id?: string | null
          location_name?: string | null
          longitude?: number | null
          name: string
          phone?: string | null
          property_name?: string | null
          property_size?: number | null
          settlement_id?: string | null
          updated_at?: string
        }
        Update: {
          caf?: string | null
          cpf?: string
          cpf_encrypted?: string | null
          created_at?: string | null
          dap_cap?: string | null
          gleba_id?: string | null
          id?: string
          latitude?: number | null
          location_id?: string | null
          location_name?: string | null
          longitude?: number | null
          name?: string
          phone?: string | null
          property_name?: string | null
          property_size?: number | null
          settlement_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "producers_gleba_id_fkey"
            columns: ["gleba_id"]
            isOneToOne: false
            referencedRelation: "glebas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producers_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producers_settlement_id_fkey"
            columns: ["settlement_id"]
            isOneToOne: false
            referencedRelation: "settlements"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          cpf: string | null
          created_at: string | null
          email: string
          id: string
          job_title: string | null
          name: string
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          cpf?: string | null
          created_at?: string | null
          email: string
          id: string
          job_title?: string | null
          name: string
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          cpf?: string | null
          created_at?: string | null
          email?: string
          id?: string
          job_title?: string | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string | null
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string | null
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string | null
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      responsible_technicians: {
        Row: {
          cargo: string | null
          cpf: string | null
          cpf_encrypted: string | null
          created_at: string | null
          id: string
          is_active: boolean
          name: string
          photo_url: string | null
          updated_at: string
        }
        Insert: {
          cargo?: string | null
          cpf?: string | null
          cpf_encrypted?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean
          name: string
          photo_url?: string | null
          updated_at?: string
        }
        Update: {
          cargo?: string | null
          cpf?: string | null
          cpf_encrypted?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean
          name?: string
          photo_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      sefaz_producers: {
        Row: {
          cpf: string | null
          cpf_encrypted: string | null
          created_at: string | null
          id: string
          location: string | null
          name: string
          phone: string | null
          settlement: string | null
          settlement_id: string | null
          updated_at: string
        }
        Insert: {
          cpf?: string | null
          cpf_encrypted?: string | null
          created_at?: string | null
          id?: string
          location?: string | null
          name: string
          phone?: string | null
          settlement?: string | null
          settlement_id?: string | null
          updated_at?: string
        }
        Update: {
          cpf?: string | null
          cpf_encrypted?: string | null
          created_at?: string | null
          id?: string
          location?: string | null
          name?: string
          phone?: string | null
          settlement?: string | null
          settlement_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sefaz_producers_settlement_id_fkey"
            columns: ["settlement_id"]
            isOneToOne: false
            referencedRelation: "settlements"
            referencedColumns: ["id"]
          },
        ]
      }
      sefaz_services: {
        Row: {
          created_at: string | null
          id: string
          notes: string | null
          sefaz_producer_id: string
          service_date: string
          service_type: string
          signed_list: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          notes?: string | null
          sefaz_producer_id: string
          service_date?: string
          service_type: string
          signed_list?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string | null
          id?: string
          notes?: string | null
          sefaz_producer_id?: string
          service_date?: string
          service_type?: string
          signed_list?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sefaz_services_sefaz_producer_id_fkey"
            columns: ["sefaz_producer_id"]
            isOneToOne: false
            referencedRelation: "sefaz_producers"
            referencedColumns: ["id"]
          },
        ]
      }
      service_photos: {
        Row: {
          captured_at: string | null
          created_at: string | null
          event_type: string | null
          id: string
          latitude: number | null
          longitude: number | null
          note: string | null
          odometer_km: number | null
          service_id: string
          storage_path: string | null
        }
        Insert: {
          captured_at?: string | null
          created_at?: string | null
          event_type?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          note?: string | null
          odometer_km?: number | null
          service_id: string
          storage_path?: string | null
        }
        Update: {
          captured_at?: string | null
          created_at?: string | null
          event_type?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          note?: string | null
          odometer_km?: number | null
          service_id?: string
          storage_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_photos_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          appointment_date: string | null
          cancellation_reason: string | null
          completed_at: string | null
          completion_notes: string | null
          comunicado_emitido: boolean
          created_at: string | null
          created_by: string | null
          dam_issued: boolean
          dam_issued_at: string | null
          dam_paid: boolean
          dam_paid_at: string | null
          dam_receipt_url: string | null
          dam_value: number | null
          demand_type_id: string
          distance_km: number | null
          fuel_consumption_per_km: number | null
          fuel_liters: number | null
          id: string
          input_quantity: number | null
          latitude: number | null
          limestone_order_url: string | null
          limestone_paid: boolean | null
          limestone_quantity: number | null
          loaded_at: string | null
          location_id: string | null
          longitude: number | null
          machinery_id: string | null
          notes: string | null
          operator_id: string | null
          position: number | null
          priority: string
          producer_id: string
          property_id: string | null
          purpose: string | null
          responsible_technician_id: string | null
          scheduled_date: string
          settlement_id: string | null
          status: string
          sync_status: string | null
          updated_at: string | null
          worked_area: number | null
          worked_hours: number | null
        }
        Insert: {
          appointment_date?: string | null
          cancellation_reason?: string | null
          completed_at?: string | null
          completion_notes?: string | null
          comunicado_emitido?: boolean
          created_at?: string | null
          created_by?: string | null
          dam_issued?: boolean
          dam_issued_at?: string | null
          dam_paid?: boolean
          dam_paid_at?: string | null
          dam_receipt_url?: string | null
          dam_value?: number | null
          demand_type_id: string
          distance_km?: number | null
          fuel_consumption_per_km?: number | null
          fuel_liters?: number | null
          id?: string
          input_quantity?: number | null
          latitude?: number | null
          limestone_order_url?: string | null
          limestone_paid?: boolean | null
          limestone_quantity?: number | null
          loaded_at?: string | null
          location_id?: string | null
          longitude?: number | null
          machinery_id?: string | null
          notes?: string | null
          operator_id?: string | null
          position?: number | null
          priority?: string
          producer_id: string
          property_id?: string | null
          purpose?: string | null
          responsible_technician_id?: string | null
          scheduled_date: string
          settlement_id?: string | null
          status?: string
          sync_status?: string | null
          updated_at?: string | null
          worked_area?: number | null
          worked_hours?: number | null
        }
        Update: {
          appointment_date?: string | null
          cancellation_reason?: string | null
          completed_at?: string | null
          completion_notes?: string | null
          comunicado_emitido?: boolean
          created_at?: string | null
          created_by?: string | null
          dam_issued?: boolean
          dam_issued_at?: string | null
          dam_paid?: boolean
          dam_paid_at?: string | null
          dam_receipt_url?: string | null
          dam_value?: number | null
          demand_type_id?: string
          distance_km?: number | null
          fuel_consumption_per_km?: number | null
          fuel_liters?: number | null
          id?: string
          input_quantity?: number | null
          latitude?: number | null
          limestone_order_url?: string | null
          limestone_paid?: boolean | null
          limestone_quantity?: number | null
          loaded_at?: string | null
          location_id?: string | null
          longitude?: number | null
          machinery_id?: string | null
          notes?: string | null
          operator_id?: string | null
          position?: number | null
          priority?: string
          producer_id?: string
          property_id?: string | null
          purpose?: string | null
          responsible_technician_id?: string | null
          scheduled_date?: string
          settlement_id?: string | null
          status?: string
          sync_status?: string | null
          updated_at?: string | null
          worked_area?: number | null
          worked_hours?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "services_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_demand_type_id_fkey"
            columns: ["demand_type_id"]
            isOneToOne: false
            referencedRelation: "demand_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_machinery_id_fkey"
            columns: ["machinery_id"]
            isOneToOne: false
            referencedRelation: "machinery"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_producer_id_fkey"
            columns: ["producer_id"]
            isOneToOne: false
            referencedRelation: "producers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_producer_id_fkey"
            columns: ["producer_id"]
            isOneToOne: false
            referencedRelation: "producers_cpf_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "producer_properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_responsible_technician_id_fkey"
            columns: ["responsible_technician_id"]
            isOneToOne: false
            referencedRelation: "responsible_technicians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_settlement_id_fkey"
            columns: ["settlement_id"]
            isOneToOne: false
            referencedRelation: "settlements"
            referencedColumns: ["id"]
          },
        ]
      }
      settlements: {
        Row: {
          created_at: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      termos_responsabilidade: {
        Row: {
          condutor_id: string
          created_at: string
          created_by: string | null
          data_fim: string | null
          data_inicio: string | null
          destino: string | null
          file_path: string | null
          id: string
          machinery_id: string
          observacao: string | null
          origem: string | null
          updated_at: string
        }
        Insert: {
          condutor_id: string
          created_at?: string
          created_by?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          destino?: string | null
          file_path?: string | null
          id?: string
          machinery_id: string
          observacao?: string | null
          origem?: string | null
          updated_at?: string
        }
        Update: {
          condutor_id?: string
          created_at?: string
          created_by?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          destino?: string | null
          file_path?: string | null
          id?: string
          machinery_id?: string
          observacao?: string | null
          origem?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "termos_responsabilidade_condutor_id_fkey"
            columns: ["condutor_id"]
            isOneToOne: false
            referencedRelation: "condutores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "termos_responsabilidade_machinery_id_fkey"
            columns: ["machinery_id"]
            isOneToOne: false
            referencedRelation: "machinery"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      viagens: {
        Row: {
          condutor_id: string | null
          created_at: string
          created_by: string | null
          data_retorno: string | null
          data_saida: string | null
          destino: string | null
          finalidade: string | null
          id: string
          machinery_id: string
          nad: string | null
          observacao: string | null
          origem: string | null
          status: string
          termo_id: string | null
          updated_at: string
        }
        Insert: {
          condutor_id?: string | null
          created_at?: string
          created_by?: string | null
          data_retorno?: string | null
          data_saida?: string | null
          destino?: string | null
          finalidade?: string | null
          id?: string
          machinery_id: string
          nad?: string | null
          observacao?: string | null
          origem?: string | null
          status?: string
          termo_id?: string | null
          updated_at?: string
        }
        Update: {
          condutor_id?: string | null
          created_at?: string
          created_by?: string | null
          data_retorno?: string | null
          data_saida?: string | null
          destino?: string | null
          finalidade?: string | null
          id?: string
          machinery_id?: string
          nad?: string | null
          observacao?: string | null
          origem?: string | null
          status?: string
          termo_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "viagens_condutor_id_fkey"
            columns: ["condutor_id"]
            isOneToOne: false
            referencedRelation: "condutores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "viagens_machinery_id_fkey"
            columns: ["machinery_id"]
            isOneToOne: false
            referencedRelation: "machinery"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "viagens_termo_id_fkey"
            columns: ["termo_id"]
            isOneToOne: false
            referencedRelation: "termos_responsabilidade"
            referencedColumns: ["id"]
          },
        ]
      }
      vitrine_documentos: {
        Row: {
          created_at: string
          created_by: string | null
          file_path: string | null
          fornecedor_id: string
          id: string
          numero: string | null
          observacao: string | null
          situacao: string
          tipo: string
          updated_at: string
          validade: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          file_path?: string | null
          fornecedor_id: string
          id?: string
          numero?: string | null
          observacao?: string | null
          situacao?: string
          tipo: string
          updated_at?: string
          validade?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          file_path?: string | null
          fornecedor_id?: string
          id?: string
          numero?: string | null
          observacao?: string | null
          situacao?: string
          tipo?: string
          updated_at?: string
          validade?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vitrine_documentos_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "vitrine_fornecedores"
            referencedColumns: ["id"]
          },
        ]
      }
      vitrine_fornecedores: {
        Row: {
          aceita_contato: boolean
          created_at: string
          created_by: string | null
          data_nascimento: string | null
          email: string | null
          genero: string | null
          id: string
          latitude: number | null
          localidade: string | null
          longitude: number | null
          nome: string
          observacao_interna: string | null
          origem: string
          perfis: string[]
          producer_id: string | null
          programas: string[]
          settlement_id: string | null
          status: string
          telefone: string | null
          updated_at: string
          validado_em: string | null
          validado_por: string | null
          whatsapp: string | null
        }
        Insert: {
          aceita_contato?: boolean
          created_at?: string
          created_by?: string | null
          data_nascimento?: string | null
          email?: string | null
          genero?: string | null
          id?: string
          latitude?: number | null
          localidade?: string | null
          longitude?: number | null
          nome: string
          observacao_interna?: string | null
          origem?: string
          perfis?: string[]
          producer_id?: string | null
          programas?: string[]
          settlement_id?: string | null
          status?: string
          telefone?: string | null
          updated_at?: string
          validado_em?: string | null
          validado_por?: string | null
          whatsapp?: string | null
        }
        Update: {
          aceita_contato?: boolean
          created_at?: string
          created_by?: string | null
          data_nascimento?: string | null
          email?: string | null
          genero?: string | null
          id?: string
          latitude?: number | null
          localidade?: string | null
          longitude?: number | null
          nome?: string
          observacao_interna?: string | null
          origem?: string
          perfis?: string[]
          producer_id?: string | null
          programas?: string[]
          settlement_id?: string | null
          status?: string
          telefone?: string | null
          updated_at?: string
          validado_em?: string | null
          validado_por?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vitrine_fornecedores_producer_id_fkey"
            columns: ["producer_id"]
            isOneToOne: false
            referencedRelation: "producers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vitrine_fornecedores_producer_id_fkey"
            columns: ["producer_id"]
            isOneToOne: false
            referencedRelation: "producers_cpf_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vitrine_fornecedores_settlement_id_fkey"
            columns: ["settlement_id"]
            isOneToOne: false
            referencedRelation: "settlements"
            referencedColumns: ["id"]
          },
        ]
      }
      vitrine_ofertas: {
        Row: {
          ativo: boolean
          capacidade_mensal: number | null
          created_at: string
          created_by: string | null
          embalagem: string | null
          emite_nota: boolean | null
          entrega_propria: boolean | null
          forma: string | null
          fornecedor_id: string
          frequencia: string | null
          id: string
          meses: number[]
          observacao: string | null
          preco: number | null
          preco_atualizado_em: string | null
          preco_entregue: boolean
          preco_inclui: string[]
          produto_id: string
          programa: string | null
          qtd_aceita: number | null
          qtd_mensal: number | null
          registro_sanitario: string | null
          situacao: string
          situacao_em: string | null
          situacao_por: string | null
          unidade: string
          updated_at: string
          validade_dias: number | null
          variedade_id: string | null
        }
        Insert: {
          ativo?: boolean
          capacidade_mensal?: number | null
          created_at?: string
          created_by?: string | null
          embalagem?: string | null
          emite_nota?: boolean | null
          entrega_propria?: boolean | null
          forma?: string | null
          fornecedor_id: string
          frequencia?: string | null
          id?: string
          meses?: number[]
          observacao?: string | null
          preco?: number | null
          preco_atualizado_em?: string | null
          preco_entregue?: boolean
          preco_inclui?: string[]
          produto_id: string
          programa?: string | null
          qtd_aceita?: number | null
          qtd_mensal?: number | null
          registro_sanitario?: string | null
          situacao?: string
          situacao_em?: string | null
          situacao_por?: string | null
          unidade?: string
          updated_at?: string
          validade_dias?: number | null
          variedade_id?: string | null
        }
        Update: {
          ativo?: boolean
          capacidade_mensal?: number | null
          created_at?: string
          created_by?: string | null
          embalagem?: string | null
          emite_nota?: boolean | null
          entrega_propria?: boolean | null
          forma?: string | null
          fornecedor_id?: string
          frequencia?: string | null
          id?: string
          meses?: number[]
          observacao?: string | null
          preco?: number | null
          preco_atualizado_em?: string | null
          preco_entregue?: boolean
          preco_inclui?: string[]
          produto_id?: string
          programa?: string | null
          qtd_aceita?: number | null
          qtd_mensal?: number | null
          registro_sanitario?: string | null
          situacao?: string
          situacao_em?: string | null
          situacao_por?: string | null
          unidade?: string
          updated_at?: string
          validade_dias?: number | null
          variedade_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vitrine_ofertas_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "vitrine_fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vitrine_ofertas_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "vitrine_produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vitrine_ofertas_variedade_id_fkey"
            columns: ["variedade_id"]
            isOneToOne: false
            referencedRelation: "vitrine_variedades"
            referencedColumns: ["id"]
          },
        ]
      }
      vitrine_precos_hist: {
        Row: {
          id: string
          oferta_id: string
          preco: number | null
          preco_entregue: boolean | null
          registrado_em: string
          registrado_por: string | null
          unidade: string | null
        }
        Insert: {
          id?: string
          oferta_id: string
          preco?: number | null
          preco_entregue?: boolean | null
          registrado_em?: string
          registrado_por?: string | null
          unidade?: string | null
        }
        Update: {
          id?: string
          oferta_id?: string
          preco?: number | null
          preco_entregue?: boolean | null
          registrado_em?: string
          registrado_por?: string | null
          unidade?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vitrine_precos_hist_oferta_id_fkey"
            columns: ["oferta_id"]
            isOneToOne: false
            referencedRelation: "vitrine_ofertas"
            referencedColumns: ["id"]
          },
        ]
      }
      vitrine_produtos: {
        Row: {
          ativo: boolean
          categoria: string
          created_at: string
          id: string
          nome: string
          unidade_padrao: string
        }
        Insert: {
          ativo?: boolean
          categoria: string
          created_at?: string
          id?: string
          nome: string
          unidade_padrao?: string
        }
        Update: {
          ativo?: boolean
          categoria?: string
          created_at?: string
          id?: string
          nome?: string
          unidade_padrao?: string
        }
        Relationships: []
      }
      vitrine_variedades: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          produto_id: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          produto_id: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          produto_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vitrine_variedades_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "vitrine_produtos"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      delivery_lot_summary: {
        Row: {
          created_at: string | null
          created_by: string | null
          demand_type_category: string | null
          demand_type_id: string | null
          demand_type_name: string | null
          finalized_quantity: number | null
          id: string | null
          initial_quantity: number | null
          is_active: boolean | null
          lot_date: string | null
          name: string | null
          notes: string | null
          remaining_quantity: number | null
          reserved_quantity: number | null
          responsible_technician_id: string | null
          supplier: string | null
          unit: string | null
          used_quantity: number | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_lots_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_lots_demand_type_id_fkey"
            columns: ["demand_type_id"]
            isOneToOne: false
            referencedRelation: "demand_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_lots_responsible_technician_id_fkey"
            columns: ["responsible_technician_id"]
            isOneToOne: false
            referencedRelation: "responsible_technicians"
            referencedColumns: ["id"]
          },
        ]
      }
      producers_cpf_view: {
        Row: {
          cpf_display: string | null
          created_at: string | null
          dap_cap: string | null
          id: string | null
          latitude: number | null
          location_id: string | null
          location_name: string | null
          longitude: number | null
          name: string | null
          phone: string | null
          property_name: string | null
          property_size: number | null
          settlement_id: string | null
        }
        Insert: {
          cpf_display?: never
          created_at?: string | null
          dap_cap?: string | null
          id?: string | null
          latitude?: number | null
          location_id?: string | null
          location_name?: string | null
          longitude?: number | null
          name?: string | null
          phone?: string | null
          property_name?: string | null
          property_size?: number | null
          settlement_id?: string | null
        }
        Update: {
          cpf_display?: never
          created_at?: string | null
          dap_cap?: string | null
          id?: string | null
          latitude?: number | null
          location_id?: string | null
          location_name?: string | null
          longitude?: number | null
          name?: string | null
          phone?: string | null
          property_name?: string | null
          property_size?: number | null
          settlement_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "producers_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producers_settlement_id_fkey"
            columns: ["settlement_id"]
            isOneToOne: false
            referencedRelation: "settlements"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      admin_producer_cpfs: {
        Args: never
        Returns: {
          cpf: string
          id: string
        }[]
      }
      admin_profile_cpfs: {
        Args: never
        Returns: {
          cpf: string
          id: string
        }[]
      }
      batch_update_service_positions: {
        Args: { updates: Json }
        Returns: undefined
      }
      bootstrap_first_admin: { Args: { _user_id: string }; Returns: boolean }
      coordenada_propriedade_do_atendimento: {
        Args: { _service_id: string }
        Returns: {
          lat: number
          lng: number
        }[]
      }
      coordenada_valida: {
        Args: { _lat: number; _lng: number }
        Returns: boolean
      }
      copiar_localizacao_para_propriedade: {
        Args: { _service_id: string }
        Returns: boolean
      }
      cpf_digitos: { Args: { _v: string }; Returns: string }
      cpf_formatado: { Args: { _v: string }; Returns: string }
      custo_maquinas: {
        Args: { _fim: string; _inicio: string }
        Returns: {
          atendimentos: number
          categoria: string
          custo_combustivel: number
          custo_hora: number
          custo_manutencao: number
          custo_total: number
          hectares: number
          horas: number
          litros: number
          litros_atendimentos: number
          litros_hora: number
          litros_sem_preco: number
          machinery_id: string
          manutencoes: number
          manutencoes_sem_custo: number
          nome: string
        }[]
      }
      decrypt_cpf: { Args: { encrypted_cpf: string }; Returns: string }
      desfazer_unificacao: { Args: { _backup_id: string }; Returns: Json }
      encrypt_cpf: { Args: { plain_cpf: string }; Returns: string }
      has_any_admin: { Args: never; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_coordenador: { Args: { _uid: string }; Returns: boolean }
      mask_cpf: { Args: { plain_cpf: string }; Returns: string }
      next_comunicado_dam: { Args: never; Returns: number }
      nome_normalizado: { Args: { _v: string }; Returns: string }
      operator_shares_service: {
        Args: {
          _demand_type_id: string
          _producer_id: string
          _property_id: string
          _settlement_id: string
          _uid: string
        }
        Returns: boolean
      }
      produtores_parecidos: {
        Args: {
          _cpf?: string
          _ignorar_id?: string
          _nome: string
          _settlement_id?: string
          _telefone?: string
        }
        Returns: {
          id: string
          motivo: string
          name: string
          settlement_name: string
        }[]
      }
      unificar_produtores: {
        Args: { _manter: string; _remover: string }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "operator"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "operator"],
    },
  },
} as const
