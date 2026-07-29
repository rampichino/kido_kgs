// @flow
import React, { PureComponent as Component } from "react";
import { Button, SelectInput } from "../common";
import { LOCALE_OPTIONS, LOCALE_KEY, setStoredLocale } from "../../util/locale";
import type { User, UserDetails } from "../../model";

type Props = {
  user: User,
  details: UserDetails,
  onSave: (user: User, details: UserDetails, newPassword: string) => any,
  onCancel: Function,
};

type State = {
  details: UserDetails,
  newPassword: string,
  passwordError: ?string,
  locale: string,
};

// Minimum length for a new password. Only enforced when the user actually
// enters one (leaving the field blank keeps the existing password).
const MIN_PASSWORD_LENGTH = 8;

// The locale the user has explicitly chosen (pending next login), or null when
// they never picked one — so the account's current server locale can show
// instead.
function readPendingLocale(): ?string {
  try {
    return localStorage.getItem(LOCALE_KEY);
  } catch (e) {
    return null;
  }
}

export default class UserDetailsEditForm extends Component<Props, State> {
  static defaultProps: {};

  state = {
    details: {
      ...this.props.details,
      rankWanted:
        this.props.user.rank === undefined || this.props.user.rank === null
          ? false
          : true,
    },
    newPassword: "",
    passwordError: null,
    // Prefer a locale the user already picked (pending next login); else show
    // what the server currently reports for this account, else the default.
    locale: readPendingLocale() || this.props.details.locale || "en_US",
  };

  render() {
    let { details, newPassword, passwordError, locale } = this.state;
    let countryCode = locale.split(/[_-]/)[1];
    countryCode =
      countryCode && countryCode.length === 2
        ? countryCode.toLowerCase()
        : null;
    return (
      <div className="UserDetailsEditForm">
        <div className="UserDetailsEditForm-fields">
          <input
            type="text"
            name="personalName"
            autoCapitalize="words"
            placeholder="Your Name"
            value={details.personalName}
            onChange={this._onChangeInput}
          />
          <input
            type="email"
            name="email"
            placeholder="Your Email"
            value={details.email}
            onChange={this._onChangeInput}
          />
          <input
            type="password"
            name="newPassword"
            placeholder="New Password (leave blank to keep existing)"
            value={newPassword}
            onChange={this._onChangeInput}
            className={
              passwordError ? "UserDetailsEditForm-input-error" : undefined
            }
          />
          {passwordError ? (
            <div className="UserDetailsEditForm-field-error">
              {passwordError}
            </div>
          ) : null}
          <div className="UserDetailsEditForm-country">
            <div className="UserDetailsEditForm-country-row">
              {countryCode ? (
                <span
                  className={
                    "fi fi-" + countryCode + " UserDetailsEditForm-country-flag"
                  }
                />
              ) : null}
              <SelectInput
                name="locale"
                value={locale}
                onChange={this._onChangeLocale}>
                {LOCALE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </SelectInput>
            </div>
            <span className="UserDetailsEditForm-country-note">
              Country updates on your next login.
            </span>
          </div>
          <div className="UserDetailsEditForm-bio">
            <textarea
              name="personalInfo"
              placeholder="Bio"
              value={details.personalInfo}
              maxLength={1500}
              onChange={this._onChangeInput}
            />
            <span className="UserDetailsEditForm-bio-count">
              {(details.personalInfo || "").length} / 1500
            </span>
          </div>
        </div>
        <div className="UserDetailsEditForm-buttons">
          <Button primary onClick={this._onSave}>
            Save Changes
          </Button>
        </div>
      </div>
    );
  }

  _onChangeInput = (e: Object) => {
    let target = e.target;
    if (target.name === "newPassword") {
      this.setState({ newPassword: target.value, passwordError: null });
    } else {
      if (target.type === "text" || target.nodeName === "TEXTAREA") {
        const value =
          target.name === "personalInfo"
            ? target.value.slice(0, 1500)
            : target.value;
        this.setState({
          details: {
            ...this.state.details,
            [target.name]: value,
          },
        });
      } else if (target.type === "checkbox") {
        this.setState({
          details: {
            ...this.state.details,
            [target.name]: target.checked,
          },
        });
      }
    }
  };

  _onChangeLocale = (e: Object) => {
    this.setState({ locale: e.target.value });
  };

  _onSave = () => {
    let { newPassword } = this.state;
    // Only validate when a new password is actually being set (blank keeps the
    // existing one).
    if (newPassword && newPassword.length < MIN_PASSWORD_LENGTH) {
      this.setState({
        passwordError: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      });
      return;
    }
    // Locale isn't part of DETAILS_CHANGE — the server only takes it at login,
    // so persist it locally for the next sign-in.
    setStoredLocale(this.state.locale);
    this.props.onSave(this.props.user, this.state.details, newPassword);
  };
}
