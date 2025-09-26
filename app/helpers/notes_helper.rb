require 'cgi'

module NotesHelper

  NOTES_TAGS = %w(a br b em strong i)

  def recurse_replies(replies)
    return "" if replies.nil?
    html = ""
    replies.each do |reply|
      reply_html = <<-html
        <div class="reply">
          <div class="reply_author">
            <b>#{get_username(reply.creator)}</b> #{time_ago_in_words(DateTime.parse(@note.created))} #{I18n.t('notes.time_ago_suffix')}
          </div>
          <div class="reply_body">
            #{sanitize reply.body, tags: NOTES_TAGS}<br/>
          </div>
          <div class="reply_meta">
            <a href="#reply" class="reply_reply" data-parent-id="#{reply.id}" data-parent-type="reply">#{I18n.t('notes.actions.reply')}</a>
          </div>
          <div class="discussion">
            <div class="discussion_container">
              #{recurse_replies(reply.respond_to?(:children) ? reply.children : nil)}
            </div>
          </div>
        </div>
      html
      html << reply_html
    end
    html
  end

  def proposal_html(note)
    return "" unless note.respond_to?(:proposal) && note.proposal
    case note.proposal.type
    when "ProposalNewClass"
      html = <<-html
        <table class="proposal">
          <tr>
            <th>#{I18n.t('notes.proposals.reason_for_change')}</th>
            <td>#{note.proposal.reasonForChange}</td>
          <tr>
            <th>#{I18n.t('notes.proposals.contact_info')}</th>
            <td>#{note.proposal.contactInfo}</td>
          </tr>
          <tr>
            <th>#{I18n.t('notes.proposals.preferred_name')}</th>
            <td>#{note.proposal.label}</td>
          <tr>
            <th>#{I18n.t('notes.proposals.provisional_id')}</th>
            <td>#{note.proposal.classId}</td>
          <tr>
            <th>#{I18n.t('notes.proposals.parent')}</th>
            <td>#{note.proposal.parent}</td>
          </tr>
          <tr>
            <th>#{I18n.t('notes.proposals.synonyms')}</th>
            <td>#{note.proposal.synonym.join(", ")}</td>
          </tr>
          <tr>
            <th>#{I18n.t('notes.proposals.definition')}</th>
            <td>#{note.proposal.definition.join(", ")}</td>
          </tr>
        </table>
      html
    when "ProposalChangeHierarchy"
      html = <<-html
        <table class="proposal">
          <tr>
            <th>#{I18n.t('notes.proposals.relationship_type')}</th>
            <td>#{note.proposal.newRelationshipType.join(", ")}</td>
          </tr>
          <tr>
            <th>#{I18n.t('notes.proposals.new_relationship_target')}</th>
            <td colspan="3">#{note.proposal.newTarget}</td>
          </tr>
          <tr>
            <th>#{I18n.t('notes.proposals.old_relationship_target')}</th>
            <td colspan="3">#{note.proposal.oldTarget}</td>
          </tr>
          <tr>
            <th>#{I18n.t('notes.proposals.reason_for_change')}</th>
            <td>#{note.proposal.reasonForChange}</td>
          <tr>
            <th>#{I18n.t('notes.proposals.contact_info')}</th>
            <td>#{note.proposal.contactInfo}</td>
          </tr>
        </table>
      html
    when "ProposalChangeProperty"
      html = <<-html
        <table class="proposal">
          <tr>
            <th>#{I18n.t('notes.proposals.property_id')}</th>
            <td>#{note.proposal.propertyId}</td>
          </tr>
          <tr>
            <th>#{I18n.t('notes.proposals.new_property_value')}</th>
            <td colspan="3">#{note.proposal.newValue}</td>
          </tr>
          <tr>
            <th>#{I18n.t('notes.proposals.old_property_value')}</th>
            <td colspan="3">#{note.proposal.oldValue}</td>
          </tr>
          <tr>
            <th>#{I18n.t('notes.proposals.reason_for_change')}</th>
            <td>#{note.proposal.reasonForChange}</td>
          <tr>
            <th>#{I18n.t('notes.proposals.contact_info')}</th>
            <td>#{note.proposal.contactInfo}</td>
          </tr>
        </table>
      html
    end

    html
  end

  def get_note_type_text(note_type)
    case note_type
    when "Comment"
      return I18n.t('notes.types.comment')
    when "ProposalNewClass"
      return I18n.t('notes.types.new_class_proposal')
    when "ProposalChangeHierarchy"
      return I18n.t('notes.types.new_relationship_proposal')
    when "ProposalChangeProperty"
      return I18n.t('notes.types.change_property_value_proposal')
    end
  end

  def subscribe_button(ontology_id)
    user = session[:user]

    if user.nil?
      return link_to(I18n.t('notes.subscribe.login_prompt'), login_index_path, class: 'link_button')
    end

    # Init subscribe button parameters.
    sub_text = I18n.t('notes.subscribe.subscribe')
    params = "data-bp_ontology_id='#{ontology_id}' data-bp_is_subbed='false' data-bp_user_id='#{user.id}'"
    begin
      # Try to create an intelligent subscribe button.
      if ontology_id.start_with? 'http'
        ont = LinkedData::Client::Models::Ontology.find(ontology_id)
      else
        ont = LinkedData::Client::Models::Ontology.find_by_acronym(ontology_id).first
      end
      subscribed = subscribed_to_ontology?(ont.acronym, user)  # application_helper
      sub_text = subscribed ? I18n.t('notes.subscribe.unsubscribe_from') : I18n.t('notes.subscribe.subscribe_to')
      params = "data-bp_ontology_id='#{ont.acronym}' data-bp_is_subbed='#{subscribed}' data-bp_user_id='#{user.id}'"
    rescue
      # pass, fallback init done above begin block to scope parameters beyond the begin/rescue block
    end
    spinner = '<span class="notes_subscribe_spinner" style="display: none;">' + image_tag("spinners/spinner_000000_16px.gif", style: "vertical-align: text-bottom;") + '</span>'
    error = "<span style='color: red;' class='notes_sub_error'></span>"
    return "<a href='javascript:void(0);' class='subscribe_to_notes link_button' #{params}>#{sub_text} #{I18n.t('notes.subscribe.notes_emails_suffix')}</a> #{spinner} #{error}".html_safe
  end

  def delete_button
    user = session[:user]
    # TODO_REV: Enable anonymous user
    # user ||= anonymous_user

    params = "data-bp_user_id='#{user.id}'"
    spinner = '<span class="delete_notes_spinner" style="display: none;">' + image_tag("spinners/spinner_000000_16px.gif", style: "vertical-align: text-bottom;") + '</span>'
    error = "<span style='color: red;' class='delete_notes_error'></span>"
    return "<a href='#' onclick='deleteNotes(this);return false;' style='display: inline-block !important;' class='notes_delete link_button' #{params}>#{I18n.t('notes.actions.delete_selected')}</a> #{spinner} #{error}"
  end

end
