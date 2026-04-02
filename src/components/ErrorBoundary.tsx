import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { T } from "../tokens";
import { logger } from "../services/logger";
import Btn from "./Btn";
import Icon from "./Icon";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  reported: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  private error: Error | null = null;
  private errorInfo: ErrorInfo | null = null;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, reported: false };
  }

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.error = error;
    this.errorInfo = errorInfo;
    logger.error("ErrorBoundary", "Unhandled render error", {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReport = () => {
    logger.error("ErrorBoundary", "User reported error", {
      message: this.error?.message,
      stack: this.error?.stack,
      componentStack: this.errorInfo?.componentStack,
    });
    this.setState({ reported: true });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          background: T.bg,
          padding: 24,
        }}
      >
        <div
          style={{
            textAlign: "center",
            maxWidth: 440,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 16,
          }}
        >
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: "50%",
              background: T.urgentLight,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="alert" size={34} color={T.urgent} />
          </div>

          <div>
            <h1
              style={{
                fontFamily: T.fontDisplay,
                fontSize: 28,
                fontWeight: 400,
                color: T.text,
                marginBottom: 8,
              }}
            >
              Something went wrong
            </h1>
            <p style={{ fontSize: 14, color: T.textSub, lineHeight: 1.6 }}>
              The application encountered an unexpected error. Your data is safe
              — please reload to continue.
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            {!this.state.reported ? (
              <Btn variant="secondary" onClick={this.handleReport}>
                Report Issue
              </Btn>
            ) : (
              <span style={{ fontSize: 13, color: T.accent, fontWeight: 500 }}>
                Reported — thank you
              </span>
            )}
            <Btn variant="primary" onClick={this.handleReload}>
              Reload Application
            </Btn>
          </div>
        </div>
      </div>
    );
  }
}
