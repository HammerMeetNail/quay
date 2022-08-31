import {Component, Inject} from 'ng-metadata/core';

@Component({
  selector: 'new-ui-toggle',
  templateUrl: '/static/js/directives/ui/new-ui-toggle/new-ui-toggle.component.html',
})
export class NewUiToggleComponent {
  private newUIIsActive: boolean = false;

  constructor(@Inject('ApiService') private ApiService: any,
              @Inject('$window') private $window: ng.IWindowService,
              @Inject('$location') private $location: ng.ILocationService) {
  }

  private handleToogleClick($event): void {
    this.newUIIsActive = !this.newUIIsActive;
    $('#newBetaUIModal').modal('show');
  }

  private useNewUI($event): void {
    let protocol = window.location.protocol;
    let host = window.location.host;
    window.location.replace(`${protocol}//${host}/react`);
    $('#newBetaUIModal').modal('hide');
  }
}
