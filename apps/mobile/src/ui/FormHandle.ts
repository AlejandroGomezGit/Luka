/** Lo que un formulario expone a su pantalla: «Guardar» vive en la barra superior y lo invoca. */
export interface FormHandle {
  submit: () => void;
}
