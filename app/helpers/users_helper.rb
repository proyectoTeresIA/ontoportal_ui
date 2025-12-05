# frozen_string_literal: true

module UsersHelper
  def custom_ontology_set_intro_text
    tag.div do
      concat(tag.p do
        concat(tag.span(t('users.show.custom_ontology_intro'), class: 'fw-bold text-muted'))
        concat(tag.span(" #{t('users.show.custom_ontology_description', site: $SITE)}",
                        class: 'text-muted'))
      end)
      concat(tag.p(t('users.show.custom_ontology_login_note'), class: 'fst-italic text-muted'))
    end
  end

  def custom_ontology_set_slice_text
    tag.p class: 'mb-5' do
      concat(t('users.show.custom_ontology_slice_prefix'))
      concat(link_to(t('users.show.custom_ontology_slice_link'), "#{$UI_URL}/account"))
      concat(t('users.show.custom_ontology_slice_suffix'))
    end
  end
end
