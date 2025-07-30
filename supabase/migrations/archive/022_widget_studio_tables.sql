-- Widget Studio Tables
-- Stores user-created widgets with versioning and sharing capabilities

-- Create widgets table
CREATE TABLE IF NOT EXISTS public.widgets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    code TEXT NOT NULL,
    dependencies JSONB DEFAULT '{}',
    props JSONB DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    version TEXT DEFAULT '1.0.0',
    is_public BOOLEAN DEFAULT false,
    is_template BOOLEAN DEFAULT false,
    fork_of UUID REFERENCES public.widgets(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create widget versions table for history
CREATE TABLE IF NOT EXISTS public.widget_versions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    widget_id UUID REFERENCES public.widgets(id) ON DELETE CASCADE,
    version_number TEXT NOT NULL,
    code TEXT NOT NULL,
    dependencies JSONB DEFAULT '{}',
    props JSONB DEFAULT '{}',
    changelog TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(widget_id, version_number)
);

-- Create widget shares table for collaboration
CREATE TABLE IF NOT EXISTS public.widget_shares (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    widget_id UUID REFERENCES public.widgets(id) ON DELETE CASCADE,
    shared_with UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    permission TEXT CHECK (permission IN ('view', 'edit')) DEFAULT 'view',
    shared_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(widget_id, shared_with)
);

-- Create widget likes table
CREATE TABLE IF NOT EXISTS public.widget_likes (
    widget_id UUID REFERENCES public.widgets(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (widget_id, user_id)
);

-- Create widget comments table
CREATE TABLE IF NOT EXISTS public.widget_comments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    widget_id UUID REFERENCES public.widgets(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    parent_id UUID REFERENCES public.widget_comments(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_widgets_user_id ON public.widgets(user_id);
CREATE INDEX idx_widgets_is_public ON public.widgets(is_public);
CREATE INDEX idx_widgets_is_template ON public.widgets(is_template);
CREATE INDEX idx_widgets_tags ON public.widgets USING GIN(tags);
CREATE INDEX idx_widgets_created_at ON public.widgets(created_at DESC);
CREATE INDEX idx_widget_versions_widget_id ON public.widget_versions(widget_id);
CREATE INDEX idx_widget_shares_widget_id ON public.widget_shares(widget_id);
CREATE INDEX idx_widget_shares_shared_with ON public.widget_shares(shared_with);
CREATE INDEX idx_widget_likes_widget_id ON public.widget_likes(widget_id);
CREATE INDEX idx_widget_comments_widget_id ON public.widget_comments(widget_id);

-- Create RLS policies
ALTER TABLE public.widgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.widget_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.widget_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.widget_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.widget_comments ENABLE ROW LEVEL SECURITY;

-- Widgets policies
CREATE POLICY "Users can view their own widgets" ON public.widgets
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view public widgets" ON public.widgets
    FOR SELECT USING (is_public = true);

CREATE POLICY "Users can view shared widgets" ON public.widgets
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.widget_shares
            WHERE widget_shares.widget_id = widgets.id
            AND widget_shares.shared_with = auth.uid()
        )
    );

CREATE POLICY "Users can create widgets" ON public.widgets
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own widgets" ON public.widgets
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can update shared widgets with edit permission" ON public.widgets
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.widget_shares
            WHERE widget_shares.widget_id = widgets.id
            AND widget_shares.shared_with = auth.uid()
            AND widget_shares.permission = 'edit'
        )
    );

CREATE POLICY "Users can delete their own widgets" ON public.widgets
    FOR DELETE USING (auth.uid() = user_id);

-- Widget versions policies
CREATE POLICY "Users can view versions of accessible widgets" ON public.widget_versions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.widgets
            WHERE widgets.id = widget_versions.widget_id
            AND (
                widgets.user_id = auth.uid()
                OR widgets.is_public = true
                OR EXISTS (
                    SELECT 1 FROM public.widget_shares
                    WHERE widget_shares.widget_id = widgets.id
                    AND widget_shares.shared_with = auth.uid()
                )
            )
        )
    );

CREATE POLICY "Users can create versions for their widgets" ON public.widget_versions
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.widgets
            WHERE widgets.id = widget_versions.widget_id
            AND (
                widgets.user_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM public.widget_shares
                    WHERE widget_shares.widget_id = widgets.id
                    AND widget_shares.shared_with = auth.uid()
                    AND widget_shares.permission = 'edit'
                )
            )
        )
    );

-- Widget shares policies
CREATE POLICY "Widget owners can manage shares" ON public.widget_shares
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.widgets
            WHERE widgets.id = widget_shares.widget_id
            AND widgets.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can view their shares" ON public.widget_shares
    FOR SELECT USING (shared_with = auth.uid());

-- Widget likes policies
CREATE POLICY "Anyone can view likes on public widgets" ON public.widget_likes
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.widgets
            WHERE widgets.id = widget_likes.widget_id
            AND widgets.is_public = true
        )
    );

CREATE POLICY "Users can like accessible widgets" ON public.widget_likes
    FOR INSERT WITH CHECK (
        auth.uid() = user_id
        AND EXISTS (
            SELECT 1 FROM public.widgets
            WHERE widgets.id = widget_likes.widget_id
            AND (
                widgets.is_public = true
                OR widgets.user_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM public.widget_shares
                    WHERE widget_shares.widget_id = widgets.id
                    AND widget_shares.shared_with = auth.uid()
                )
            )
        )
    );

CREATE POLICY "Users can unlike widgets" ON public.widget_likes
    FOR DELETE USING (auth.uid() = user_id);

-- Widget comments policies
CREATE POLICY "Anyone can view comments on public widgets" ON public.widget_comments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.widgets
            WHERE widgets.id = widget_comments.widget_id
            AND widgets.is_public = true
        )
    );

CREATE POLICY "Users can comment on accessible widgets" ON public.widget_comments
    FOR INSERT WITH CHECK (
        auth.uid() = user_id
        AND EXISTS (
            SELECT 1 FROM public.widgets
            WHERE widgets.id = widget_comments.widget_id
            AND (
                widgets.is_public = true
                OR widgets.user_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM public.widget_shares
                    WHERE widget_shares.widget_id = widgets.id
                    AND widget_shares.shared_with = auth.uid()
                )
            )
        )
    );

CREATE POLICY "Users can update their own comments" ON public.widget_comments
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments" ON public.widget_comments
    FOR DELETE USING (auth.uid() = user_id);

-- Create functions for widget management
CREATE OR REPLACE FUNCTION public.fork_widget(source_widget_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_widget_id UUID;
BEGIN
    -- Create a new widget as a fork
    INSERT INTO public.widgets (
        user_id,
        name,
        description,
        code,
        dependencies,
        props,
        tags,
        version,
        fork_of
    )
    SELECT
        auth.uid(),
        name || ' (Fork)',
        description,
        code,
        dependencies,
        props,
        tags,
        '1.0.0',
        source_widget_id
    FROM public.widgets
    WHERE id = source_widget_id
    AND (
        is_public = true
        OR user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.widget_shares
            WHERE widget_id = source_widget_id
            AND shared_with = auth.uid()
        )
    )
    RETURNING id INTO new_widget_id;
    
    RETURN new_widget_id;
END;
$$;

-- Create function to get widget statistics
CREATE OR REPLACE FUNCTION public.get_widget_stats(widget_id UUID)
RETURNS TABLE (
    likes_count BIGINT,
    comments_count BIGINT,
    versions_count BIGINT,
    shares_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        (SELECT COUNT(*) FROM public.widget_likes WHERE widget_likes.widget_id = $1),
        (SELECT COUNT(*) FROM public.widget_comments WHERE widget_comments.widget_id = $1),
        (SELECT COUNT(*) FROM public.widget_versions WHERE widget_versions.widget_id = $1),
        (SELECT COUNT(*) FROM public.widget_shares WHERE widget_shares.widget_id = $1);
END;
$$;

-- Create trigger to update widget updated_at
CREATE OR REPLACE FUNCTION public.update_widget_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_widgets_updated_at
    BEFORE UPDATE ON public.widgets
    FOR EACH ROW
    EXECUTE FUNCTION public.update_widget_updated_at();

CREATE TRIGGER update_widget_comments_updated_at
    BEFORE UPDATE ON public.widget_comments
    FOR EACH ROW
    EXECUTE FUNCTION public.update_widget_updated_at();