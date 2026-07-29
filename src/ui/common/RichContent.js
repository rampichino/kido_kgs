// @flow
import React, { PureComponent as Component } from "react";
import Autolinker from "autolinker.js";
import { nl2br, escapeHtml, quoteRegExpPattern } from "../../util/string";

type Props = {
  content: ?string,
  firstLineHeading?: ?boolean,
  // Username to wrap in a mention-highlight span. Must be applied here, after
  // escaping — injecting the span into `content` would get escaped and render
  // as literal HTML.
  highlightUser?: ?string,
};

export class RichContent extends Component<Props> {
  render() {
    let { content, firstLineHeading, highlightUser } = this.props;
    if (!content || !content.trim()) {
      return null;
    }
    let opts = {
      newWindow: true,
      stripPrefix: false,
      truncate: null,
      className: "RichContent-link",
      urls: true,
      email: true,
      twitter: false,
    };
    let escaped = escapeHtml(content);
    if (highlightUser) {
      escaped = escaped.replace(
        new RegExp("@(" + quoteRegExpPattern(highlightUser) + ")\\b", "gi"),
        '<span class="ChatMessages-mention">@$1</span>'
      );
    }
    let html = nl2br(Autolinker.link(escaped, opts));
    if (firstLineHeading) {
      html = html.replace(
        /(.+?)<br>/,
        "<div class='RichContent-heading'>$1</div>"
      );
    }
    return (
      <div className="RichContent" dangerouslySetInnerHTML={{ __html: html }} />
    );
  }
}
