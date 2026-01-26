-- 1. Criar enum para roles
CREATE TYPE public.app_role AS ENUM ('admin', 'operator');

-- 2. Tabela de roles (segurança crítica - separada)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, role)
);

-- 3. Tabela de perfis
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Tipos de demanda
CREATE TABLE public.demand_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Assentamentos
CREATE TABLE public.settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Localidades
CREATE TABLE public.locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    settlement_id UUID REFERENCES public.settlements(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Produtores
CREATE TABLE public.producers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    cpf TEXT UNIQUE NOT NULL,
    phone TEXT,
    settlement_id UUID REFERENCES public.settlements(id),
    location_id UUID REFERENCES public.locations(id),
    property_name TEXT,
    property_size DECIMAL,
    dap_cap TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Demandas dos produtores (N:N)
CREATE TABLE public.producer_demands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    producer_id UUID REFERENCES public.producers(id) ON DELETE CASCADE NOT NULL,
    demand_type_id UUID REFERENCES public.demand_types(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (producer_id, demand_type_id)
);

-- 9. Atendimentos (services)
CREATE TABLE public.services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    producer_id UUID REFERENCES public.producers(id) ON DELETE CASCADE NOT NULL,
    demand_type_id UUID REFERENCES public.demand_types(id) NOT NULL,
    settlement_id UUID REFERENCES public.settlements(id),
    location_id UUID REFERENCES public.locations(id),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    scheduled_date DATE NOT NULL,
    notes TEXT,
    operator_id UUID REFERENCES auth.users(id),
    completed_at TIMESTAMPTZ,
    completion_notes TEXT,
    latitude DECIMAL,
    longitude DECIMAL,
    sync_status TEXT DEFAULT 'synced',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Fotos dos atendimentos
CREATE TABLE public.service_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID REFERENCES public.services(id) ON DELETE CASCADE NOT NULL,
    storage_path TEXT NOT NULL,
    latitude DECIMAL,
    longitude DECIMAL,
    captured_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Função de verificação de role (Security Definer - evita recursão RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 12. Função para criar perfil automaticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'name', 'Usuário'));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 13. Trigger para criar perfil
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 14. Função para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 15. Triggers para updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_services_updated_at
  BEFORE UPDATE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============== HABILITAR RLS ==============

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demand_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.producers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.producer_demands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_photos ENABLE ROW LEVEL SECURITY;

-- ============== POLÍTICAS RLS ==============

-- user_roles: usuário vê própria role, admin gerencia
CREATE POLICY "Users can view own role" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- profiles: todos autenticados podem ver, próprio pode editar
CREATE POLICY "Profiles viewable by authenticated" ON public.profiles
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);

-- demand_types: leitura para todos, escrita só admin
CREATE POLICY "Demand types viewable by authenticated" ON public.demand_types
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "Admins can manage demand types" ON public.demand_types
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- settlements: leitura para todos, escrita só admin
CREATE POLICY "Settlements viewable by authenticated" ON public.settlements
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "Admins can manage settlements" ON public.settlements
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- locations: leitura para todos, escrita só admin
CREATE POLICY "Locations viewable by authenticated" ON public.locations
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "Admins can manage locations" ON public.locations
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- producers: leitura para todos, escrita só admin
CREATE POLICY "Producers viewable by authenticated" ON public.producers
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "Admins can manage producers" ON public.producers
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- producer_demands: leitura para todos, escrita só admin
CREATE POLICY "Producer demands viewable by authenticated" ON public.producer_demands
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "Admins can manage producer demands" ON public.producer_demands
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- services: leitura para todos, admin pode tudo, operator pode criar/editar
CREATE POLICY "Services viewable by authenticated" ON public.services
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "Admins can manage services" ON public.services
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Operators can create services" ON public.services
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'operator'));

CREATE POLICY "Operators can update assigned services" ON public.services
  FOR UPDATE TO authenticated USING (
    public.has_role(auth.uid(), 'operator') AND operator_id = auth.uid()
  );

-- service_photos: leitura para todos, admin/operator podem criar
CREATE POLICY "Photos viewable by authenticated" ON public.service_photos
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "Admins can manage photos" ON public.service_photos
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Operators can add photos" ON public.service_photos
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'operator'));

-- ============== STORAGE BUCKET ==============

INSERT INTO storage.buckets (id, name, public)
VALUES ('service-photos', 'service-photos', true);

-- Políticas de storage
CREATE POLICY "Photos publicly viewable" ON storage.objects
  FOR SELECT USING (bucket_id = 'service-photos');

CREATE POLICY "Authenticated users can upload photos" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'service-photos');

CREATE POLICY "Admins can delete photos" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'service-photos' AND 
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );