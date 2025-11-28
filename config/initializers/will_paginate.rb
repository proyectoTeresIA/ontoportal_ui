# frozen_string_literal: true

require 'will_paginate/view_helpers/action_view'

# Custom link renderer for chip-button-styled pagination
class ChipButtonLinkRenderer < WillPaginate::ActionView::LinkRenderer
  PREV_ICON = '<i class="fas fa-chevron-left"></i>'.freeze
  NEXT_ICON = '<i class="fas fa-chevron-right"></i>'.freeze

  protected

  def container_attributes
    super.merge(class: 'chip-pagination')
  end

  def page_number(page)
    if page == current_page
      tag(:span, page, class: 'chip-page-item chip-page-active')
    else
      link(page, page, class: 'chip-page-item chip-page-link')
    end
  end

  def gap
    tag(:span, '&hellip;', class: 'chip-page-item chip-page-gap')
  end

  def previous_or_next_page(page, text, classname)
    icon = classname.to_s.include?('prev') ? PREV_ICON : NEXT_ICON
    if page
      link(icon, page, class: "chip-page-item chip-page-nav #{classname}")
    else
      tag(:span, icon, class: "chip-page-item chip-page-nav chip-page-disabled #{classname}")
    end
  end

  def html_container(html)
    tag(:nav, html, container_attributes)
  end
end
