// Defines template for the EnumModel

foam.CLASS({
  refines: 'foam.core.EnumModel',

  templates: [
    {
      name: 'javaSource',
      template: `
// Generated by FOAM, do not modify.

package <%= this.package %>;
<%
var labelForValue = function(value) {
  return '"' + value.definition.label + '"';
}

%>
public enum <%= this.name %> {
<%
  for ( var i = 0 ; i < this.values.length ; i++ ) {
    var value = this.values[i];
    if ( value.javaSource ) { value.javaSource(out); }
    else {
%>  <%= value.name %>(<%= value.definition.ordinal %>, <%= labelForValue(value) %>) <%
    }
    if ( i == this.values.length - 1 ) {%>;<%}
    else {%>,<%}
  }
%>

  private final int ordinal_;
  private final String label_;
  <%= this.name %>(int ordinal, String label) {
    ordinal_ = ordinal;
    label_ = label;
  }

  public int getOrdinal() { return ordinal_; }
  public String getLabel() { return label_; }

  public static <%= this.name %> forOrdinal(int ordinal) {
    switch (ordinal) {
<% for (var i = 0, value; value = this.values[i]; i++) { %>
      case <%= value.definition.ordinal %>: return <%= this.name %>.<%= value.name %>;
<% } %>
    }
    return null;
  }

  public static <%= this.name %> forLabel(String label) {
    switch (label) {
<% for (var i = 0, value; value = this.values[i]; i++) { %>
      case <%= labelForValue(value) %>: return <%= this.name %>.<%= value.name %>;
<% } %>
    }

    return null;
  }

  public static String[] labels() {
    return new String[] {
<% for (var i = 0, value; value = this.values[i]; i++) { %>
      <%= labelForValue(value) %>,
<% } %>
    };
  }
}
      `
    }
  ]
})
